import { and, eq, isNull, lte, or, gt } from 'drizzle-orm';
import { schema, type Database } from '@portl/database';
import { DomainError } from '@portl/domain';
import { roleSchema, type Profile, type Role } from '@portl/contracts';

export interface Identity {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}
export interface Context {
  user: Identity;
  societyId: string;
  membershipId: string;
  role: Role;
  flatIds: string[];
  towerIds: string[];
}

export async function profile(db: Database, identity: Identity): Promise<Profile> {
  const rows = await db
    .select({ member: schema.memberships, society: schema.societies })
    .from(schema.memberships)
    .innerJoin(schema.societies, eq(schema.memberships.societyId, schema.societies.id))
    .where(
      and(eq(schema.memberships.userId, identity.id), eq(schema.memberships.status, 'active')),
    );
  const result: Profile = {
    id: identity.id,
    name: identity.name,
    email: identity.email,
    memberships: [],
  };
  for (const row of rows) {
    const homes = await db
      .select({ flat: schema.flats, tower: schema.towers })
      .from(schema.occupancies)
      .innerJoin(schema.flats, eq(schema.occupancies.flatId, schema.flats.id))
      .innerJoin(schema.towers, eq(schema.flats.towerId, schema.towers.id))
      .where(
        and(
          eq(schema.occupancies.membershipId, row.member.id),
          lte(schema.occupancies.startsAt, new Date()),
          or(isNull(schema.occupancies.endsAt), gt(schema.occupancies.endsAt, new Date())),
        ),
      );
    result.memberships.push({
      id: row.member.id,
      society: row.society,
      roles: row.member.roles,
      flatIds: homes.map((h) => h.flat.id),
      homeLabel: homes.map((h) => `${h.tower.name} · ${h.flat.number}`).join(', '),
    });
  }
  return result;
}

export async function getContext(
  db: Database,
  identity: Identity,
  societyId: string,
  requestedRole: unknown,
): Promise<Context> {
  const role = roleSchema.safeParse(requestedRole);
  if (!role.success) throw new DomainError('ROLE_REQUIRED', 'Choose an active role.', 400);
  const [membership] = await db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.societyId, societyId),
        eq(schema.memberships.userId, identity.id),
        eq(schema.memberships.status, 'active'),
      ),
    );
  if (!membership || !membership.roles.includes(role.data))
    throw new DomainError('FORBIDDEN', 'You do not have access to this society in that role.', 403);
  const homes = await db
    .select({ flatId: schema.flats.id, towerId: schema.flats.towerId })
    .from(schema.occupancies)
    .innerJoin(schema.flats, eq(schema.occupancies.flatId, schema.flats.id))
    .where(
      and(
        eq(schema.occupancies.membershipId, membership.id),
        lte(schema.occupancies.startsAt, new Date()),
        or(isNull(schema.occupancies.endsAt), gt(schema.occupancies.endsAt, new Date())),
      ),
    );
  return {
    user: identity,
    societyId,
    membershipId: membership.id,
    role: role.data,
    flatIds: homes.map((h) => h.flatId),
    towerIds: homes.map((h) => h.towerId),
  };
}
