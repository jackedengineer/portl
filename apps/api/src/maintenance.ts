import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { schema as s, type Database } from '@portl/database';
export async function runMaintenance(db: Database, now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * 86400000);
  await db
    .update(s.visits)
    .set({ status: 'expired' })
    .where(and(inArray(s.visits.status, ['requested', 'approved']), lte(s.visits.expiresAt, now)));
  await db
    .delete(s.visits)
    .where(
      and(
        inArray(s.visits.status, ['exited', 'expired', 'rejected', 'revoked']),
        lt(sql`coalesce(${s.visits.exitedAt}, ${s.visits.expiresAt})`, ago(90)),
      ),
    );
  await db.delete(s.guestPasses).where(lt(s.guestPasses.validUntil, ago(90)));
  await db.delete(s.notifications).where(lt(s.notifications.createdAt, ago(30)));
  await db.delete(s.auditEvents).where(lt(s.auditEvents.createdAt, ago(365)));
  await db.delete(s.verification).where(lt(s.verification.expiresAt, now));
  await db.delete(s.session).where(lt(s.session.expiresAt, now));
  await db.delete(s.invitations).where(lt(s.invitations.expiresAt, ago(30)));
  await db.delete(s.rateLimit).where(lt(s.rateLimit.lastRequest, now.getTime() - 86400000));
  const deletions = await db
    .select()
    .from(s.deletionRequests)
    .orderBy(s.deletionRequests.createdAt)
    .limit(50);
  let deleted = 0;
  for (const deletion of deletions) {
    const done = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select()
        .from(s.deletionRequests)
        .where(eq(s.deletionRequests.id, deletion.id))
        .for('update');
      if (!pending) return false;
      const own = await tx
        .select()
        .from(s.memberships)
        .where(eq(s.memberships.userId, pending.userId));
      for (const membership of own.filter(
        (m) => m.roles.includes('admin') && m.status === 'active',
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
              m.userId !== pending.userId && m.roles.includes('admin') && m.status === 'active',
          )
        )
          return false;
      }
      const bookings = await tx
        .select({ booking: s.bookings, slot: s.amenitySlots })
        .from(s.bookings)
        .innerJoin(s.amenitySlots, eq(s.bookings.slotId, s.amenitySlots.id))
        .where(
          and(
            eq(s.bookings.userId, pending.userId),
            eq(s.bookings.status, 'confirmed'),
            gt(s.amenitySlots.startsAt, now),
          ),
        );
      for (const { booking, slot } of bookings.sort((a, b) => a.slot.id.localeCompare(b.slot.id))) {
        await tx.select().from(s.amenitySlots).where(eq(s.amenitySlots.id, slot.id)).for('update');
        const changed = await tx
          .update(s.bookings)
          .set({ status: 'cancelled' })
          .where(and(eq(s.bookings.id, booking.id), eq(s.bookings.status, 'confirmed')))
          .returning();
        if (changed.length)
          await tx
            .update(s.amenitySlots)
            .set({ reserved: sql`${s.amenitySlots.reserved} - 1` })
            .where(eq(s.amenitySlots.id, slot.id));
      }
      const [user] = await tx.select().from(s.user).where(eq(s.user.id, pending.userId));
      if (user)
        await tx.delete(s.invitations).where(eq(s.invitations.email, user.email.toLowerCase()));
      await tx.delete(s.user).where(eq(s.user.id, pending.userId));
      return true;
    });
    if (done) deleted++;
  }
  return { deleted };
}
