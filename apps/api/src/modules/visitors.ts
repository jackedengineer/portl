import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema, type Database } from '@portl/database';
import {
  assertOwnFlat,
  checkPassWindow,
  DomainError,
  requireRole,
  transitionVisit,
} from '@portl/domain';
import type { PassInput, VisitAction, VisitInput } from '@portl/contracts';
import type { Context } from '../context.js';
import { audit, householdUsers, notify } from '../events.js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function registerVisit(db: Database, ctx: Context, input: VisitInput) {
  requireRole(ctx.role, ['guard']);
  return db.transaction(async (tx) => {
    const [flat] = await tx
      .select()
      .from(schema.flats)
      .where(and(eq(schema.flats.id, input.flatId), eq(schema.flats.societyId, ctx.societyId)));
    if (!flat) throw new DomainError('NOT_FOUND', 'Flat not found.', 404);
    const [existing] = await tx
      .select()
      .from(schema.visits)
      .where(eq(schema.visits.id, input.requestId));
    if (existing) {
      if (
        existing.societyId === ctx.societyId &&
        existing.requestedBy === ctx.user.id &&
        existing.flatId === input.flatId &&
        existing.name === input.name &&
        existing.kind === input.kind &&
        existing.company === (input.company ?? '') &&
        existing.note === (input.note ?? '')
      )
        return existing;
      throw new DomainError(
        'REQUEST_CONFLICT',
        'This request identifier has already been used.',
        409,
      );
    }
    const recipients = await householdUsers(tx, ctx.societyId, input.flatId);
    if (!recipients.length)
      throw new DomainError(
        'NO_RESIDENT',
        'No active residents are assigned to this flat. Contact the society office.',
        409,
      );
    const [visit] = await tx
      .insert(schema.visits)
      .values({
        id: input.requestId,
        societyId: ctx.societyId,
        flatId: input.flatId,
        name: input.name,
        kind: input.kind,
        company: input.company,
        note: input.note,
        requestedBy: ctx.user.id,
        expiresAt: new Date(Date.now() + 15 * 60000),
      })
      .returning();
    await notify(
      tx,
      ctx.societyId,
      recipients,
      'Someone is at the gate',
      'A visitor request needs your attention.',
      visit!.id,
    );
    await audit(tx, ctx, 'visit.requested', visit!.id);
    return visit!;
  });
}

export async function decideVisit(db: Database, ctx: Context, id: string, action: VisitAction) {
  return db.transaction(async (tx) => {
    const [visit] = await tx
      .select()
      .from(schema.visits)
      .where(and(eq(schema.visits.id, id), eq(schema.visits.societyId, ctx.societyId)))
      .for('update');
    if (!visit) throw new DomainError('NOT_FOUND', 'Visit not found.', 404);
    assertOwnFlat(ctx.role, ctx.flatIds, visit.flatId);
    const status = transitionVisit(visit.status, action, ctx.role, visit.expiresAt);
    const [updated] = await tx
      .update(schema.visits)
      .set({
        status,
        ...(['approve', 'reject'].includes(action) ? { decidedBy: ctx.user.id } : {}),
        ...(action === 'enter' ? { enteredAt: new Date() } : {}),
        ...(action === 'exit' ? { exitedAt: new Date() } : {}),
      })
      .where(and(eq(schema.visits.id, id), eq(schema.visits.status, visit.status)))
      .returning();
    if (!updated)
      throw new DomainError('VISIT_CHANGED', 'Someone has already updated this visit.', 409);
    const guards = await tx
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.societyId, ctx.societyId),
          eq(schema.memberships.status, 'active'),
        ),
      );
    const recipients = ['approve', 'reject', 'revoke'].includes(action)
      ? guards.filter((m) => m.roles.includes('guard')).map((m) => m.userId)
      : await householdUsers(tx, ctx.societyId, visit.flatId);
    await notify(
      tx,
      ctx.societyId,
      recipients,
      'Visitor update',
      `A visit has been ${status}. Open Portl for details.`,
      id,
    );
    await audit(tx, ctx, `visit.${status}`, id);
    return updated;
  });
}

export async function createPass(db: Database, ctx: Context, input: PassInput) {
  requireRole(ctx.role, ['resident']);
  assertOwnFlat(ctx.role, ctx.flatIds, input.flatId);
  const validFrom = new Date(input.validFrom),
    validUntil = new Date(input.validUntil);
  if (
    validUntil <= new Date() ||
    validUntil.getTime() - validFrom.getTime() > 7 * 86400000 ||
    validFrom.getTime() > Date.now() + 90 * 86400000
  )
    throw new DomainError(
      'INVALID_WINDOW',
      'Choose a future visit, with a pass lasting at most 7 days.',
    );
  const token = randomBytes(24).toString('base64url');
  const pass = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.guestPasses)
      .values({
        societyId: ctx.societyId,
        flatId: input.flatId,
        name: input.name,
        note: input.note,
        validFrom,
        validUntil,
        tokenHash: hashToken(token),
        createdBy: ctx.user.id,
      })
      .returning();
    await audit(tx, ctx, 'pass.created', row!.id);
    return row!;
  });
  return { id: pass.id, token };
}

export async function redeemPass(db: Database, ctx: Context, token: string) {
  requireRole(ctx.role, ['guard']);
  return db.transaction(async (tx) => {
    const [pass] = await tx
      .select()
      .from(schema.guestPasses)
      .where(
        and(
          eq(schema.guestPasses.tokenHash, hashToken(token)),
          eq(schema.guestPasses.societyId, ctx.societyId),
        ),
      )
      .for('update');
    if (!pass)
      throw new DomainError('PASS_NOT_FOUND', 'This pass was not found in your society.', 404);
    if (pass.status !== 'active')
      throw new DomainError('PASS_USED', 'This pass has already been used or revoked.', 409);
    checkPassWindow(pass.validFrom, pass.validUntil);
    const recipients = await householdUsers(tx, ctx.societyId, pass.flatId);
    if (!recipients.includes(pass.createdBy))
      throw new DomainError(
        'PASS_REVOKED',
        'The person who issued this pass no longer has access.',
        409,
      );
    await tx
      .update(schema.guestPasses)
      .set({ status: 'used' })
      .where(eq(schema.guestPasses.id, pass.id));
    const [visit] = await tx
      .insert(schema.visits)
      .values({
        id: randomUUID(),
        societyId: ctx.societyId,
        flatId: pass.flatId,
        name: pass.name,
        kind: 'guest',
        note: pass.note,
        status: 'approved',
        requestedBy: ctx.user.id,
        decidedBy: pass.createdBy,
        expiresAt: pass.validUntil,
      })
      .returning();
    await audit(tx, ctx, 'pass.redeemed', pass.id);
    await notify(
      tx,
      ctx.societyId,
      recipients,
      'Your guest has arrived',
      'A pre-approved guest is at the gate.',
      visit!.id,
    );
    return visit!;
  });
}

export async function revokePass(db: Database, ctx: Context, id: string) {
  requireRole(ctx.role, ['resident', 'admin']);
  return db.transaction(async (tx) => {
    const [pass] = await tx
      .select()
      .from(schema.guestPasses)
      .where(and(eq(schema.guestPasses.id, id), eq(schema.guestPasses.societyId, ctx.societyId)))
      .for('update');
    if (!pass) throw new DomainError('NOT_FOUND', 'Pass not found.', 404);
    assertOwnFlat(ctx.role, ctx.flatIds, pass.flatId);
    if (pass.status !== 'active')
      throw new DomainError('PASS_CHANGED', 'This pass is no longer active.', 409);
    await tx
      .update(schema.guestPasses)
      .set({ status: 'revoked' })
      .where(eq(schema.guestPasses.id, id));
    await audit(tx, ctx, 'pass.revoked', id);
  });
}
