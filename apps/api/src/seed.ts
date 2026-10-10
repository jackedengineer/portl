import { createDatabase, schema as s } from '@portl/database';
import { createDemoOverview, demoId, demoUsers } from '@portl/domain/demo';
if (process.env.ALLOW_DEMO_SEED !== 'true' || process.env.NODE_ENV === 'production')
  throw new Error(
    'Use an isolated development database and set ALLOW_DEMO_SEED=true. Production seeding is disabled.',
  );
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const { db, pool } = createDatabase(process.env.DATABASE_URL),
  d = createDemoOverview();
try {
  await db.transaction(async (tx) => {
    await tx.insert(s.societies).values(d.society);
    await tx
      .insert(s.user)
      .values(Object.values(demoUsers).map((u) => ({ ...u, emailVerified: false })));
    await tx.insert(s.towers).values(d.towers.map((t) => ({ ...t, societyId: d.society.id })));
    await tx.insert(s.flats).values(
      d.flats.map((f) => ({
        id: f.id,
        societyId: d.society.id,
        towerId: f.towerId,
        number: f.number,
      })),
    );
    await tx.insert(s.memberships).values(
      d.members.map((m, i) => ({
        id: m.id,
        societyId: d.society.id,
        userId: demoId(10 + i),
        roles: m.roles,
      })),
    );
    await tx
      .insert(s.occupancies)
      .values({ societyId: d.society.id, membershipId: demoId(20), flatId: demoId(40) });
    for (const a of d.amenities) {
      await tx.insert(s.amenities).values({
        id: a.id,
        societyId: d.society.id,
        name: a.name,
        description: a.description,
        kind: a.kind,
        capacity: a.capacity,
      });
      await tx.insert(s.amenitySlots).values(
        a.slots.map((slot) => ({
          id: slot.id,
          societyId: d.society.id,
          amenityId: a.id,
          startsAt: new Date(slot.startsAt),
          endsAt: new Date(slot.endsAt),
          capacity: slot.capacity,
          reserved: 0,
        })),
      );
    }
    await tx.insert(s.notices).values(
      d.notices.map((n) => ({
        ...n,
        societyId: d.society.id,
        publishedAt: new Date(n.publishedAt),
      })),
    );
    await tx
      .insert(s.staff)
      .values(d.staff.map((staff) => ({ ...staff, societyId: d.society.id })));
  });
  console.info(
    'Fictional society data seeded. Accounts are unverified and do not bypass email OTP.',
  );
} finally {
  await pool.end();
}
