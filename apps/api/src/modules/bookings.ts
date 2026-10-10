import { and, eq, sql } from 'drizzle-orm';
import { schema, type Database } from '@portl/database';
import { assertBookingAvailable, DomainError, requireRole } from '@portl/domain';
import type { Context } from '../context.js';
import { audit, notify } from '../events.js';

export async function bookSlot(db: Database, ctx: Context, slotId: string) {
  requireRole(ctx.role, ['resident']);
  if (!ctx.flatIds.length)
    throw new DomainError('HOUSEHOLD_REQUIRED', 'An active household membership is required.', 403);
  return db.transaction(async (tx) => {
    // Serialize new bookings with access suspension and account deletion.
    const [member] = await tx
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.id, ctx.membershipId),
          eq(schema.memberships.societyId, ctx.societyId),
          eq(schema.memberships.userId, ctx.user.id),
        ),
      )
      .for('share');
    if (!member || member.status !== 'active' || !member.roles.includes('resident'))
      throw new DomainError(
        'FORBIDDEN',
        'Your society access has changed. Refresh before booking.',
        403,
      );
    const [slot] = await tx
      .select()
      .from(schema.amenitySlots)
      .where(
        and(eq(schema.amenitySlots.id, slotId), eq(schema.amenitySlots.societyId, ctx.societyId)),
      )
      .for('update');
    if (!slot) throw new DomainError('NOT_FOUND', 'Booking slot not found.', 404);
    const [existing] = await tx
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.slotId, slotId),
          eq(schema.bookings.userId, ctx.user.id),
          eq(schema.bookings.status, 'confirmed'),
        ),
      );
    if (existing) return existing;
    assertBookingAvailable(slot.capacity, slot.reserved, slot.startsAt);
    await tx
      .update(schema.amenitySlots)
      .set({ reserved: sql`${schema.amenitySlots.reserved} + 1` })
      .where(eq(schema.amenitySlots.id, slotId));
    const [booking] = await tx
      .insert(schema.bookings)
      .values({ societyId: ctx.societyId, slotId, userId: ctx.user.id })
      .returning();
    await audit(tx, ctx, 'booking.confirmed', booking!.id);
    await notify(
      tx,
      ctx.societyId,
      [ctx.user.id],
      'A little time for yourself',
      'Your amenity booking is confirmed.',
      booking!.id,
    );
    return booking!;
  });
}

export async function cancelBooking(db: Database, ctx: Context, id: string) {
  requireRole(ctx.role, ['resident', 'admin']);
  return db.transaction(async (tx) => {
    const [initial] = await tx
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.id, id), eq(schema.bookings.societyId, ctx.societyId)));
    if (!initial) throw new DomainError('NOT_FOUND', 'Booking not found.', 404);
    if (ctx.role === 'resident' && initial.userId !== ctx.user.id)
      throw new DomainError('FORBIDDEN', 'This booking belongs to another resident.', 403);
    const [slot] = await tx
      .select()
      .from(schema.amenitySlots)
      .where(eq(schema.amenitySlots.id, initial.slotId))
      .for('update');
    if (!slot || slot.startsAt <= new Date())
      throw new DomainError(
        'BOOKING_STARTED',
        'Bookings can only be cancelled before the slot starts.',
        409,
      );
    const [updated] = await tx
      .update(schema.bookings)
      .set({ status: 'cancelled' })
      .where(and(eq(schema.bookings.id, id), eq(schema.bookings.status, 'confirmed')))
      .returning();
    if (!updated) return initial;
    await tx
      .update(schema.amenitySlots)
      .set({ reserved: sql`${schema.amenitySlots.reserved} - 1` })
      .where(eq(schema.amenitySlots.id, initial.slotId));
    await audit(tx, ctx, 'booking.cancelled', id);
    return updated;
  });
}
