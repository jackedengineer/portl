import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or, gt } from 'drizzle-orm';
import { schema, type Transaction } from '@portl/database';
import type { Context } from './context.js';

export async function audit(tx: Transaction, ctx: Context, action: string, resourceId: string) {
  await tx
    .insert(schema.auditEvents)
    .values({ societyId: ctx.societyId, actorId: ctx.user.id, action, resourceId });
}

export async function notify(
  tx: Transaction,
  societyId: string,
  userIds: string[],
  title: string,
  body: string,
  resourceId: string | null,
) {
  for (const userId of new Set(userIds)) {
    const id = randomUUID();
    await tx
      .insert(schema.notifications)
      .values({ id, societyId, userId, title, body, resourceId });
    await tx.insert(schema.outbox).values({ notificationId: id });
  }
}

export async function householdUsers(tx: Transaction, societyId: string, flatId: string) {
  const rows = await tx
    .select({ userId: schema.memberships.userId, roles: schema.memberships.roles })
    .from(schema.occupancies)
    .innerJoin(schema.memberships, eq(schema.occupancies.membershipId, schema.memberships.id))
    .where(
      and(
        eq(schema.occupancies.societyId, societyId),
        eq(schema.occupancies.flatId, flatId),
        eq(schema.memberships.status, 'active'),
        lte(schema.occupancies.startsAt, new Date()),
        or(isNull(schema.occupancies.endsAt), gt(schema.occupancies.endsAt, new Date())),
      ),
    );
  return rows.filter((r) => r.roles.includes('resident')).map((r) => r.userId);
}
