import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { schema, type Database, type Transaction } from '@portl/database';
import { DomainError, requireRole } from '@portl/domain';
import type { Context, Identity } from '../context.js';
import { audit } from '../events.js';
import { hashToken } from './visitors.js';

async function grantResident(tx: Transaction, societyId: string, userId: string, flatId: string) {
  await tx
    .insert(schema.memberships)
    .values({ societyId, userId, roles: ['resident'] })
    .onConflictDoNothing();
  const [member] = await tx
    .select()
    .from(schema.memberships)
    .where(and(eq(schema.memberships.societyId, societyId), eq(schema.memberships.userId, userId)))
    .for('update');
  if (!member || member.status !== 'active')
    throw new DomainError(
      'MEMBERSHIP_SUSPENDED',
      'Contact your society administrator to restore access.',
      403,
    );
  if (!member.roles.includes('resident'))
    await tx
      .update(schema.memberships)
      .set({ roles: [...member.roles, 'resident'] })
      .where(eq(schema.memberships.id, member.id));
  await tx
    .insert(schema.occupancies)
    .values({ societyId, membershipId: member.id, flatId })
    .onConflictDoNothing();
  return member.id;
}

export async function inviteResident(db: Database, ctx: Context, email: string, flatId: string) {
  requireRole(ctx.role, ['admin']);
  const token = randomBytes(24).toString('base64url');
  return db.transaction(async (tx) => {
    const [flat] = await tx
      .select()
      .from(schema.flats)
      .where(and(eq(schema.flats.id, flatId), eq(schema.flats.societyId, ctx.societyId)));
    if (!flat) throw new DomainError('NOT_FOUND', 'Flat not found.', 404);
    const [invite] = await tx
      .insert(schema.invitations)
      .values({
        societyId: ctx.societyId,
        flatId,
        email: email.toLowerCase(),
        tokenHash: hashToken(token),
        createdBy: ctx.user.id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      .returning();
    await audit(tx, ctx, 'invitation.created', invite!.id);
    return { id: invite!.id, token, expiresAt: invite!.expiresAt };
  });
}

export async function acceptInvitation(db: Database, identity: Identity, token: string) {
  if (!identity.emailVerified)
    throw new DomainError(
      'EMAIL_NOT_VERIFIED',
      'Verify your email before accepting an invitation.',
      403,
    );
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.tokenHash, hashToken(token)))
      .for('update');
    if (
      !invite ||
      invite.email !== identity.email.toLowerCase() ||
      invite.acceptedAt ||
      invite.expiresAt <= new Date()
    )
      throw new DomainError(
        'INVALID_INVITATION',
        'This invitation is unavailable, expired, or belongs to another email.',
        400,
      );
    const membershipId = await grantResident(tx, invite.societyId, identity.id, invite.flatId);
    await tx
      .update(schema.invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.invitations.id, invite.id));
    await tx.insert(schema.auditEvents).values({
      societyId: invite.societyId,
      actorId: identity.id,
      action: 'invitation.accepted',
      resourceId: invite.id,
    });
    return { membershipId, societyId: invite.societyId };
  });
}

export async function decideJoin(
  db: Database,
  ctx: Context,
  id: string,
  decision: 'approved' | 'rejected',
) {
  requireRole(ctx.role, ['admin']);
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(schema.joinRequests)
      .where(and(eq(schema.joinRequests.id, id), eq(schema.joinRequests.societyId, ctx.societyId)))
      .for('update');
    if (!request) throw new DomainError('NOT_FOUND', 'Join request not found.', 404);
    if (request.status !== 'pending')
      throw new DomainError('REQUEST_CHANGED', 'This request has already been reviewed.', 409);
    if (decision === 'approved') {
      const [home] = await tx
        .select({ flat: schema.flats })
        .from(schema.flats)
        .innerJoin(schema.towers, eq(schema.flats.towerId, schema.towers.id))
        .where(
          and(
            eq(schema.flats.societyId, ctx.societyId),
            eq(schema.flats.number, request.flatNumber),
            eq(schema.towers.name, request.tower),
          ),
        );
      if (!home)
        throw new DomainError(
          'FLAT_NOT_FOUND',
          'Create the matching tower and flat before approving this request.',
          409,
        );
      await grantResident(tx, ctx.societyId, request.userId, home.flat.id);
    }
    await tx
      .update(schema.joinRequests)
      .set({ status: decision })
      .where(eq(schema.joinRequests.id, id));
    await audit(tx, ctx, `join.${decision}`, id);
    return { id, status: decision };
  });
}
