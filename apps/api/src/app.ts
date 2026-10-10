import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { and, eq, sql, lt, gt } from 'drizzle-orm';
import { z } from 'zod';
import { schema as s, type Database } from '@portl/database';
import {
  amenityInput,
  flatInput,
  invitationInput,
  joinInput,
  noticeInput,
  passInput,
  slotInput,
  staffInput,
  towerInput,
  visitActionSchema,
  visitInput,
} from '@portl/contracts';
import { DomainError, requireRole } from '@portl/domain';
import { getContext, profile, type Context, type Identity } from './context.js';
import { getOverview } from './modules/overview.js';
import {
  createPass,
  decideVisit,
  redeemPass,
  registerVisit,
  revokePass,
} from './modules/visitors.js';
import { bookSlot, cancelBooking } from './modules/bookings.js';
import { acceptInvitation, decideJoin, inviteResident } from './modules/onboarding.js';
import { audit, notify } from './events.js';

export interface AppDependencies {
  db: Database;
  webOrigin: string;
  resolveIdentity: (request: Request) => Promise<Identity | null>;
  installAuth?: (app: express.Express) => void;
  onError?: (error: unknown, requestId: string) => void;
  onChange?: (societyId: string) => void;
}
const id = (value: unknown) => z.uuid().parse(value);
const context = (res: Response) => res.locals.context as Context;

export function createApp(deps: AppDependencies) {
  const { db } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: deps.webOrigin,
      credentials: true,
      allowedHeaders: ['Content-Type', 'X-Portl-Role'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader('X-Request-ID', res.locals.requestId);
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.json({ status: 'ready' });
  });
  deps.installAuth?.(app);
  app.use(express.json({ limit: '64kb' }));
  app.use('/v1', (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.get('Origin') &&
      req.get('Origin') !== deps.webOrigin
    )
      throw new DomainError('INVALID_ORIGIN', 'Request origin is not permitted.', 403);
    next();
  });
  app.use(
    '/v1',
    rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/v1', async (req, res, next) => {
    const identity = await deps.resolveIdentity(req);
    if (!identity) throw new DomainError('UNAUTHENTICATED', 'Please sign in to continue.', 401);
    if (!identity.emailVerified)
      throw new DomainError('EMAIL_NOT_VERIFIED', 'Verify your email to continue.', 403);
    const [deletion] = await db
      .select({ id: s.deletionRequests.id })
      .from(s.deletionRequests)
      .where(eq(s.deletionRequests.userId, identity.id));
    if (deletion)
      throw new DomainError('DELETION_PENDING', 'Your account is scheduled for deletion.', 403);
    res.locals.identity = identity;
    next();
  });
  app.get('/v1/me', async (_req, res) => res.json(await profile(db, res.locals.identity)));
  app.patch('/v1/me', async (req, res) => {
    const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body);
    await db
      .update(s.user)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(s.user.id, res.locals.identity.id));
    res.json({ ok: true });
  });
  app.get('/v1/me/requests', async (_req, res) => {
    const requests = await db
      .select({
        id: s.joinRequests.id,
        status: s.joinRequests.status,
        tower: s.joinRequests.tower,
        flatNumber: s.joinRequests.flatNumber,
        society: s.societies.name,
      })
      .from(s.joinRequests)
      .innerJoin(s.societies, eq(s.joinRequests.societyId, s.societies.id))
      .where(eq(s.joinRequests.userId, res.locals.identity.id));
    res.json(requests);
  });
  app.post('/v1/me/deletion', async (_req, res) => {
    await db.transaction(async (tx) => {
      const owned = await tx
        .select()
        .from(s.memberships)
        .where(eq(s.memberships.userId, res.locals.identity.id));
      for (const membership of owned.filter(
        (m) => m.status === 'active' && m.roles.includes('admin'),
      )) {
        const peers = await tx
          .select()
          .from(s.memberships)
          .where(eq(s.memberships.societyId, membership.societyId))
          .orderBy(s.memberships.id)
          .for('update');
        if (
          !peers.some(
            (m) =>
              m.userId !== res.locals.identity.id &&
              m.status === 'active' &&
              m.roles.includes('admin'),
          )
        )
          throw new DomainError(
            'LAST_ADMIN',
            'Assign another administrator before deleting your account.',
            409,
          );
      }
      await tx
        .insert(s.deletionRequests)
        .values({ userId: res.locals.identity.id })
        .onConflictDoNothing();
      await tx
        .update(s.memberships)
        .set({ status: 'suspended' })
        .where(eq(s.memberships.userId, res.locals.identity.id));
      await tx.delete(s.session).where(eq(s.session.userId, res.locals.identity.id));
      await tx.delete(s.pushDevices).where(eq(s.pushDevices.userId, res.locals.identity.id));
    });
    res.status(202).json({ message: 'Your account deletion request has been recorded.' });
  });
  app.post('/v1/invitations/accept', async (req, res) => {
    const { token } = z.object({ token: z.string().min(20).max(100) }).parse(req.body);
    res.json(await acceptInvitation(db, res.locals.identity, token));
  });
  app.post('/v1/join-requests', async (req, res) => {
    const input = joinInput.parse(req.body);
    const [society] = await db
      .select()
      .from(s.societies)
      .where(eq(s.societies.code, input.societyCode.toUpperCase()));
    if (!society)
      throw new DomainError(
        'SOCIETY_NOT_FOUND',
        'Check the society code with your administrator.',
        404,
      );
    const [request] = await db
      .insert(s.joinRequests)
      .values({
        societyId: society.id,
        userId: res.locals.identity.id,
        tower: input.tower,
        flatNumber: input.flatNumber,
      })
      .returning();
    res.status(201).json({ id: request!.id, status: 'pending' });
  });
  app.post('/v1/devices', async (req, res) => {
    const { token } = z
      .object({ token: z.string().regex(/^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/) })
      .parse(req.body);
    await db
      .insert(s.pushDevices)
      .values({ userId: res.locals.identity.id, token })
      .onConflictDoUpdate({ target: s.pushDevices.token, set: { userId: res.locals.identity.id } });
    res.status(204).end();
  });
  app.delete('/v1/devices', async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    await db
      .delete(s.pushDevices)
      .where(and(eq(s.pushDevices.userId, res.locals.identity.id), eq(s.pushDevices.token, token)));
    res.status(204).end();
  });

  const router = express.Router({ mergeParams: true });
  app.use('/v1/societies/:societyId', router);
  router.use(async (req, res, next) => {
    res.locals.context = await getContext(
      db,
      res.locals.identity,
      id(req.params.societyId),
      req.get('X-Portl-Role'),
    );
    res.on('finish', () => {
      if (req.method !== 'GET' && res.statusCode < 300) deps.onChange?.(context(res).societyId);
    });
    next();
  });
  router.get('/overview', async (_req, res) => res.json(await getOverview(db, context(res))));
  router.post('/visits', async (req, res) =>
    res.status(201).json(await registerVisit(db, context(res), visitInput.parse(req.body))),
  );
  router.post('/visits/:id/actions', async (req, res) =>
    res.json(
      await decideVisit(
        db,
        context(res),
        id(req.params.id),
        visitActionSchema.parse(req.body?.action),
      ),
    ),
  );
  router.post('/passes', async (req, res) =>
    res.status(201).json(await createPass(db, context(res), passInput.parse(req.body))),
  );
  router.post('/passes/redeem', async (req, res) =>
    res.json(
      await redeemPass(db, context(res), z.string().min(20).max(100).parse(req.body?.token)),
    ),
  );
  router.post('/passes/:id/revoke', async (req, res) => {
    await revokePass(db, context(res), id(req.params.id));
    res.status(204).end();
  });
  router.post('/bookings', async (req, res) =>
    res.status(201).json(await bookSlot(db, context(res), id(req.body?.slotId))),
  );
  router.post('/bookings/:id/cancel', async (req, res) =>
    res.json(await cancelBooking(db, context(res), id(req.params.id))),
  );
  router.post('/invitations', async (req, res) => {
    const input = invitationInput.parse(req.body);
    res.status(201).json(await inviteResident(db, context(res), input.email, input.flatId));
  });
  router.post('/join-requests/:id/decision', async (req, res) =>
    res.json(
      await decideJoin(
        db,
        context(res),
        id(req.params.id),
        z.enum(['approved', 'rejected']).parse(req.body?.decision),
      ),
    ),
  );
  router.post('/notifications/read', async (_req, res) => {
    const ctx = context(res);
    await db
      .update(s.notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(s.notifications.societyId, ctx.societyId), eq(s.notifications.userId, ctx.user.id)),
      );
    res.status(204).end();
  });
  router.use((req, res, next) => {
    requireRole(context(res).role, ['admin']);
    next();
  });
  router.post('/members/grant', async (req, res) => {
    const input = z
        .object({ email: z.email().toLowerCase(), role: z.enum(['guard', 'admin']) })
        .parse(req.body),
      ctx = context(res);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(s.user)
        .where(and(eq(s.user.email, input.email), eq(s.user.emailVerified, true)));
      if (!user)
        throw new DomainError(
          'USER_NOT_READY',
          'Ask this person to sign in with this email before assigning their role.',
          409,
        );
      const [deletion] = await tx
        .select()
        .from(s.deletionRequests)
        .where(eq(s.deletionRequests.userId, user.id));
      if (deletion)
        throw new DomainError('USER_NOT_READY', 'This account is scheduled for deletion.', 409);
      await tx
        .insert(s.memberships)
        .values({ societyId: ctx.societyId, userId: user.id, roles: [input.role] })
        .onConflictDoNothing();
      const [member] = await tx
        .select()
        .from(s.memberships)
        .where(and(eq(s.memberships.societyId, ctx.societyId), eq(s.memberships.userId, user.id)))
        .for('update');
      if (member!.status !== 'active')
        throw new DomainError(
          'MEMBERSHIP_SUSPENDED',
          'Restore this member’s access before assigning a role.',
          409,
        );
      if (!member!.roles.includes(input.role))
        await tx
          .update(s.memberships)
          .set({ roles: [...member!.roles, input.role] })
          .where(eq(s.memberships.id, member!.id));
      await audit(tx, ctx, `role.granted.${input.role}`, member!.id);
      return { id: member!.id };
    });
    res.status(201).json(result);
  });
  router.post('/towers', async (req, res) => {
    const input = towerInput.parse(req.body);
    const [row] = await db
      .insert(s.towers)
      .values({ ...input, societyId: context(res).societyId })
      .returning();
    res.status(201).json(row);
  });
  router.post('/flats', async (req, res) => {
    const input = flatInput.parse(req.body);
    const [row] = await db
      .insert(s.flats)
      .values({ ...input, societyId: context(res).societyId })
      .returning();
    res.status(201).json(row);
  });
  router.post('/notices', async (req, res) => {
    const input = noticeInput.parse(req.body),
      ctx = context(res);
    const row = await db.transaction(async (tx) => {
      const [notice] = await tx
        .insert(s.notices)
        .values({ ...input, societyId: ctx.societyId })
        .returning();
      await audit(tx, ctx, 'notice.published', notice!.id);
      const members = await tx
        .select()
        .from(s.memberships)
        .where(and(eq(s.memberships.societyId, ctx.societyId), eq(s.memberships.status, 'active')));
      let audience = members;
      if (input.towerId) {
        const homes = await tx
          .select({ membershipId: s.occupancies.membershipId })
          .from(s.occupancies)
          .innerJoin(s.flats, eq(s.occupancies.flatId, s.flats.id))
          .where(
            and(
              eq(s.occupancies.societyId, ctx.societyId),
              eq(s.flats.towerId, input.towerId),
              sql`${s.occupancies.startsAt} <= now()`,
              sql`(${s.occupancies.endsAt} is null or ${s.occupancies.endsAt} > now())`,
            ),
          );
        audience = members.filter(
          (m) =>
            m.roles.some((r) => r === 'guard' || r === 'admin') ||
            homes.some((h) => h.membershipId === m.id),
        );
      }
      await notify(
        tx,
        ctx.societyId,
        audience.map((m) => m.userId),
        'A new community notice',
        'There is a new update on your notice board.',
        notice!.id,
      );
      return notice;
    });
    res.status(201).json(row);
  });
  router.patch('/notices/:id', async (req, res) => {
    const [row] = await db
      .update(s.notices)
      .set(noticeInput.parse(req.body))
      .where(
        and(eq(s.notices.id, id(req.params.id)), eq(s.notices.societyId, context(res).societyId)),
      )
      .returning();
    if (!row) throw new DomainError('NOT_FOUND', 'Notice not found.', 404);
    res.json(row);
  });
  router.delete('/notices/:id', async (req, res) => {
    await db
      .delete(s.notices)
      .where(
        and(eq(s.notices.id, id(req.params.id)), eq(s.notices.societyId, context(res).societyId)),
      );
    res.status(204).end();
  });
  router.post('/staff', async (req, res) => {
    const [row] = await db
      .insert(s.staff)
      .values({ ...staffInput.parse(req.body), societyId: context(res).societyId })
      .returning();
    res.status(201).json(row);
  });
  router.patch('/staff/:id', async (req, res) => {
    const [row] = await db
      .update(s.staff)
      .set(staffInput.parse(req.body))
      .where(and(eq(s.staff.id, id(req.params.id)), eq(s.staff.societyId, context(res).societyId)))
      .returning();
    if (!row) throw new DomainError('NOT_FOUND', 'Directory entry not found.', 404);
    res.json(row);
  });
  router.delete('/staff/:id', async (req, res) => {
    await db
      .delete(s.staff)
      .where(and(eq(s.staff.id, id(req.params.id)), eq(s.staff.societyId, context(res).societyId)));
    res.status(204).end();
  });
  router.post('/amenities', async (req, res) => {
    const [row] = await db
      .insert(s.amenities)
      .values({ ...amenityInput.parse(req.body), societyId: context(res).societyId })
      .returning();
    res.status(201).json(row);
  });
  router.patch('/amenities/:id', async (req, res) => {
    const [row] = await db
      .update(s.amenities)
      .set(amenityInput.parse(req.body))
      .where(
        and(
          eq(s.amenities.id, id(req.params.id)),
          eq(s.amenities.societyId, context(res).societyId),
        ),
      )
      .returning();
    if (!row) throw new DomainError('NOT_FOUND', 'Amenity not found.', 404);
    res.json(row);
  });
  router.post('/amenities/:id/slots', async (req, res) => {
    const input = slotInput.parse(req.body),
      amenityId = id(req.params.id),
      ctx = context(res);
    const startsAt = new Date(input.startsAt),
      endsAt = new Date(input.endsAt);
    if (startsAt <= new Date())
      throw new DomainError('INVALID_TIME', 'Choose a future booking slot.');
    const row = await db.transaction(async (tx) => {
      const [amenity] = await tx
        .select()
        .from(s.amenities)
        .where(and(eq(s.amenities.id, amenityId), eq(s.amenities.societyId, ctx.societyId)))
        .for('update');
      if (!amenity) throw new DomainError('NOT_FOUND', 'Amenity not found.', 404);
      if (input.capacity > amenity.capacity)
        throw new DomainError('INVALID_CAPACITY', 'Slot capacity exceeds the amenity capacity.');
      const overlap = await tx
        .select()
        .from(s.amenitySlots)
        .where(
          and(
            eq(s.amenitySlots.amenityId, amenityId),
            lt(s.amenitySlots.startsAt, endsAt),
            gt(s.amenitySlots.endsAt, startsAt),
          ),
        );
      if (overlap.length)
        throw new DomainError('SLOT_OVERLAP', 'This slot overlaps an existing slot.', 409);
      const [slot] = await tx
        .insert(s.amenitySlots)
        .values({ societyId: ctx.societyId, amenityId, startsAt, endsAt, capacity: input.capacity })
        .returning();
      return slot;
    });
    res.status(201).json(row);
  });
  router.patch('/members/:id', async (req, res) => {
    const target = id(req.params.id),
      status = z.enum(['active', 'suspended']).parse(req.body?.status),
      ctx = context(res);
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(s.memberships)
        .where(eq(s.memberships.societyId, ctx.societyId))
        .orderBy(s.memberships.id)
        .for('update');
      const member = rows.find((m) => m.id === target);
      if (!member) throw new DomainError('NOT_FOUND', 'Member not found.', 404);
      if (
        status === 'suspended' &&
        member.roles.includes('admin') &&
        !rows.some((m) => m.id !== target && m.status === 'active' && m.roles.includes('admin'))
      )
        throw new DomainError(
          'LAST_ADMIN',
          'Assign another administrator before suspending the last admin.',
          409,
        );
      await tx.update(s.memberships).set({ status }).where(eq(s.memberships.id, target));
      await audit(tx, ctx, `membership.${status}`, target);
    });
    res.status(204).end();
  });
  app.use((_req, _res, next) =>
    next(new DomainError('NOT_FOUND', 'This endpoint does not exist.', 404)),
  );
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Check the supplied values.',
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    if (error instanceof DomainError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, requestId: res.locals.requestId },
      });
      return;
    }
    const code = error?.cause?.code ?? error?.code;
    if (['23505', '23503', '23514', '40001', '40P01'].includes(code)) {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'The record conflicts with existing data. Refresh and check your values.',
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    if (error?.type === 'entity.too.large') {
      res
        .status(413)
        .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'This request is too large.' } });
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: { code: 'INVALID_JSON', message: 'The request body is invalid.' } });
      return;
    }
    deps.onError?.(error, res.locals.requestId);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId: res.locals.requestId,
      },
    });
  };
  app.use(onError);
  return app;
}
