import { and, desc, eq, inArray, isNull, or, sql, lte, gt } from 'drizzle-orm';
import { schema as s, type Database } from '@portl/database';
import type { Overview } from '@portl/contracts';
import { DomainError } from '@portl/domain';
import { profile, type Context } from '../context.js';

export async function getOverview(db: Database, ctx: Context): Promise<Overview> {
  const [society] = await db.select().from(s.societies).where(eq(s.societies.id, ctx.societyId));
  if (!society) throw new DomainError('NOT_FOUND', 'Society not found.', 404);
  const own = ctx.role === 'resident';
  const homes = own
    ? ctx.flatIds.length
      ? inArray(s.flats.id, ctx.flatIds)
      : sql`false`
    : undefined;
  const visitHomes = own
    ? ctx.flatIds.length
      ? inArray(s.visits.flatId, ctx.flatIds)
      : sql`false`
    : undefined;
  const passHomes = own
    ? ctx.flatIds.length
      ? inArray(s.guestPasses.flatId, ctx.flatIds)
      : sql`false`
    : undefined;
  const [
    userProfile,
    towers,
    flatRows,
    visitRows,
    passRows,
    amenityRows,
    slots,
    bookingRows,
    notices,
    staff,
    inbox,
  ] = await Promise.all([
    profile(db, ctx.user),
    db
      .select()
      .from(s.towers)
      .where(
        and(
          eq(s.towers.societyId, ctx.societyId),
          own ? (ctx.towerIds.length ? inArray(s.towers.id, ctx.towerIds) : sql`false`) : undefined,
        ),
      ),
    db
      .select({ flat: s.flats, tower: s.towers })
      .from(s.flats)
      .innerJoin(s.towers, eq(s.flats.towerId, s.towers.id))
      .where(and(eq(s.flats.societyId, ctx.societyId), homes)),
    db
      .select({ visit: s.visits, flat: s.flats, tower: s.towers })
      .from(s.visits)
      .innerJoin(s.flats, eq(s.visits.flatId, s.flats.id))
      .innerJoin(s.towers, eq(s.flats.towerId, s.towers.id))
      .where(and(eq(s.visits.societyId, ctx.societyId), visitHomes))
      .orderBy(desc(s.visits.requestedAt))
      .limit(100),
    db
      .select({ pass: s.guestPasses, flat: s.flats, tower: s.towers })
      .from(s.guestPasses)
      .innerJoin(s.flats, eq(s.guestPasses.flatId, s.flats.id))
      .innerJoin(s.towers, eq(s.flats.towerId, s.towers.id))
      .where(and(eq(s.guestPasses.societyId, ctx.societyId), passHomes))
      .orderBy(desc(s.guestPasses.createdAt))
      .limit(100),
    db.select().from(s.amenities).where(eq(s.amenities.societyId, ctx.societyId)),
    db
      .select()
      .from(s.amenitySlots)
      .where(
        and(eq(s.amenitySlots.societyId, ctx.societyId), gt(s.amenitySlots.endsAt, new Date())),
      )
      .orderBy(s.amenitySlots.startsAt)
      .limit(200),
    ctx.role === 'guard'
      ? Promise.resolve([])
      : db
          .select({ booking: s.bookings, slot: s.amenitySlots })
          .from(s.bookings)
          .innerJoin(s.amenitySlots, eq(s.bookings.slotId, s.amenitySlots.id))
          .where(
            and(
              eq(s.bookings.societyId, ctx.societyId),
              own ? eq(s.bookings.userId, ctx.user.id) : undefined,
            ),
          )
          .orderBy(desc(s.bookings.createdAt))
          .limit(100),
    db
      .select()
      .from(s.notices)
      .where(
        and(
          eq(s.notices.societyId, ctx.societyId),
          own
            ? or(
                isNull(s.notices.towerId),
                ctx.towerIds.length ? inArray(s.notices.towerId, ctx.towerIds) : sql`false`,
              )
            : undefined,
        ),
      )
      .orderBy(desc(s.notices.publishedAt))
      .limit(100),
    db.select().from(s.staff).where(eq(s.staff.societyId, ctx.societyId)),
    db
      .select()
      .from(s.notifications)
      .where(
        and(eq(s.notifications.societyId, ctx.societyId), eq(s.notifications.userId, ctx.user.id)),
      )
      .orderBy(desc(s.notifications.createdAt))
      .limit(100),
  ]);
  const joinRows =
    ctx.role === 'admin'
      ? await db
          .select({ request: s.joinRequests, user: s.user })
          .from(s.joinRequests)
          .innerJoin(s.user, eq(s.joinRequests.userId, s.user.id))
          .where(
            and(eq(s.joinRequests.societyId, ctx.societyId), eq(s.joinRequests.status, 'pending')),
          )
          .limit(100)
      : [];
  const memberRows =
    ctx.role !== 'resident'
      ? await db
          .select({ member: s.memberships, user: s.user })
          .from(s.memberships)
          .innerJoin(s.user, eq(s.memberships.userId, s.user.id))
          .where(
            and(
              eq(s.memberships.societyId, ctx.societyId),
              ctx.role === 'guard'
                ? sql`${s.memberships.roles} @> '["resident"]'::jsonb and ${s.memberships.status} = 'active'`
                : undefined,
            ),
          )
          .limit(500)
      : [];
  const occupancyRows =
    ctx.role !== 'resident'
      ? await db
          .select()
          .from(s.occupancies)
          .where(
            and(
              eq(s.occupancies.societyId, ctx.societyId),
              lte(s.occupancies.startsAt, new Date()),
              or(isNull(s.occupancies.endsAt), gt(s.occupancies.endsAt, new Date())),
            ),
          )
      : [];
  const label = (flatId: string) => {
    const f = flatRows.find((r) => r.flat.id === flatId);
    return f ? `${f.tower.name} · ${f.flat.number}` : '';
  };
  return {
    society,
    profile: userProfile,
    generatedAt: new Date().toISOString(),
    towers: towers.map((t) => ({ id: t.id, name: t.name })),
    flats: flatRows.map(({ flat, tower }) => ({
      id: flat.id,
      towerId: flat.towerId,
      number: flat.number,
      towerName: tower.name,
    })),
    visits: visitRows.map(({ visit: v, flat, tower }) => ({
      id: v.id,
      name: v.name,
      kind: v.kind,
      company: v.company,
      note: v.note,
      flatId: v.flatId,
      flatLabel: `${tower.name} · ${flat.number}`,
      status:
        ['requested', 'approved'].includes(v.status) && v.expiresAt <= new Date()
          ? 'expired'
          : v.status,
      requestedAt: v.requestedAt.toISOString(),
      expiresAt: v.expiresAt.toISOString(),
      enteredAt: v.enteredAt?.toISOString() ?? null,
      exitedAt: v.exitedAt?.toISOString() ?? null,
      decidedBy: v.decidedBy,
    })),
    passes: passRows.map(({ pass: p, flat, tower }) => ({
      id: p.id,
      name: p.name,
      flatId: p.flatId,
      flatLabel: `${tower.name} · ${flat.number}`,
      validFrom: p.validFrom.toISOString(),
      validUntil: p.validUntil.toISOString(),
      status: p.status,
      createdBy: p.createdBy,
      note: p.note,
    })),
    amenities: amenityRows.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      kind: a.kind,
      capacity: a.capacity,
      slots: slots
        .filter((sl) => sl.amenityId === a.id)
        .map((sl) => ({
          id: sl.id,
          startsAt: sl.startsAt.toISOString(),
          endsAt: sl.endsAt.toISOString(),
          capacity: sl.capacity,
          reserved: sl.reserved,
        })),
    })),
    bookings: bookingRows.map(({ booking: b, slot }) => ({
      id: b.id,
      amenityId: slot.amenityId,
      slotId: b.slotId,
      userId: b.userId,
      status: b.status,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    })),
    notices: notices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      category: n.category,
      publishedAt: n.publishedAt.toISOString(),
      towerId: n.towerId,
    })),
    staff: staff.map(({ societyId: _, ...row }) => row),
    joinRequests: joinRows.map(({ request: r, user: u }) => ({
      id: r.id,
      name: u.name,
      email: u.email,
      tower: r.tower,
      flatNumber: r.flatNumber,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    members: memberRows.map(({ member: m, user: u }) => ({
      id: m.id,
      name: u.name,
      email: ctx.role === 'guard' ? '' : u.email,
      roles: m.roles,
      status: m.status,
      homeLabel: occupancyRows
        .filter((o) => o.membershipId === m.id)
        .map((o) => label(o.flatId))
        .join(', '),
    })),
    notifications: inbox.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      resourceId: n.resourceId,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    })),
  };
}
