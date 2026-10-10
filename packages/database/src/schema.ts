import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Role } from '@portl/contracts';

const date = (name: string) => timestamp(name, { withTimezone: true });
const key = () => uuid('id').primaryKey().defaultRandom();
const created = () => date('created_at').notNull().defaultNow();

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: created(),
  updatedAt: date('updated_at').notNull().defaultNow(),
});
export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: date('expires_at').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: created(),
    updatedAt: date('updated_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);
export const account = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: date('access_token_expires_at'),
  refreshTokenExpiresAt: date('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: created(),
  updatedAt: date('updated_at').notNull().defaultNow(),
});
export const verification = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: date('expires_at').notNull(),
    createdAt: created(),
    updatedAt: date('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);
export const rateLimit = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const societies = pgTable('societies', {
  id: key(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  city: text('city').notNull(),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  createdAt: created(),
});
export const towers = pgTable(
  'towers',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    name: text('name').notNull(),
  },
  (t) => [unique().on(t.societyId, t.id), unique().on(t.societyId, t.name)],
);
export const flats = pgTable(
  'flats',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    towerId: uuid('tower_id').notNull(),
    number: text('number').notNull(),
  },
  (t) => [
    unique().on(t.societyId, t.id),
    unique().on(t.towerId, t.number),
    foreignKey({
      columns: [t.societyId, t.towerId],
      foreignColumns: [towers.societyId, towers.id],
    }),
  ],
);
export const memberships = pgTable(
  'memberships',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roles: jsonb('roles').$type<Role[]>().notNull(),
    status: text('status', { enum: ['active', 'suspended'] })
      .notNull()
      .default('active'),
    createdAt: created(),
  },
  (t) => [
    unique().on(t.societyId, t.id),
    unique().on(t.societyId, t.userId),
    check(
      'membership_roles_valid',
      sql`${t.roles} <@ '["resident","guard","admin"]'::jsonb and jsonb_array_length(${t.roles}) > 0`,
    ),
  ],
);
export const occupancies = pgTable(
  'occupancies',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    flatId: uuid('flat_id').notNull(),
    startsAt: created(),
    endsAt: date('ends_at'),
  },
  (t) => [
    foreignKey({
      columns: [t.societyId, t.membershipId],
      foreignColumns: [memberships.societyId, memberships.id],
    }).onDelete('cascade'),
    foreignKey({ columns: [t.societyId, t.flatId], foreignColumns: [flats.societyId, flats.id] }),
    uniqueIndex('one_active_occupancy')
      .on(t.membershipId, t.flatId)
      .where(sql`${t.endsAt} is null`),
  ],
);
export const invitations = pgTable(
  'invitations',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    flatId: uuid('flat_id').notNull(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: date('expires_at').notNull(),
    acceptedAt: date('accepted_at'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [
    foreignKey({ columns: [t.societyId, t.flatId], foreignColumns: [flats.societyId, flats.id] }),
  ],
);
export const joinRequests = pgTable(
  'join_requests',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tower: text('tower').notNull(),
    flatNumber: text('flat_number').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('one_pending_join')
      .on(t.societyId, t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);
export const visitState = pgEnum('visit_state', [
  'requested',
  'approved',
  'rejected',
  'entered',
  'exited',
  'expired',
  'revoked',
]);
export const visitKind = pgEnum('visit_kind', ['guest', 'delivery', 'cab', 'service']);
export const visits = pgTable(
  'visits',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    flatId: uuid('flat_id').notNull(),
    name: text('name').notNull(),
    kind: visitKind('kind').notNull(),
    company: text('company').notNull().default(''),
    note: text('note').notNull().default(''),
    status: visitState('status').notNull().default('requested'),
    requestedBy: text('requested_by').references(() => user.id, { onDelete: 'set null' }),
    decidedBy: text('decided_by').references(() => user.id, { onDelete: 'set null' }),
    requestedAt: date('requested_at').notNull().defaultNow(),
    expiresAt: date('expires_at').notNull(),
    enteredAt: date('entered_at'),
    exitedAt: date('exited_at'),
  },
  (t) => [
    unique().on(t.societyId, t.id),
    foreignKey({ columns: [t.societyId, t.flatId], foreignColumns: [flats.societyId, flats.id] }),
    index('visit_gate_queue_idx').on(t.societyId, t.status, t.requestedAt),
    index('visit_household_idx').on(t.societyId, t.flatId, t.requestedAt),
  ],
);
export const guestPasses = pgTable(
  'guest_passes',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    flatId: uuid('flat_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    validFrom: date('valid_from').notNull(),
    validUntil: date('valid_until').notNull(),
    status: text('status', { enum: ['active', 'used', 'revoked'] })
      .notNull()
      .default('active'),
    note: text('note').notNull().default(''),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: created(),
  },
  (t) => [
    foreignKey({ columns: [t.societyId, t.flatId], foreignColumns: [flats.societyId, flats.id] }),
    check('pass_valid_window', sql`${t.validUntil} > ${t.validFrom}`),
  ],
);
export const amenities = pgTable(
  'amenities',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    kind: text('kind', { enum: ['pool', 'gym', 'court', 'clubhouse'] }).notNull(),
    capacity: integer('capacity').notNull(),
  },
  (t) => [
    unique().on(t.societyId, t.id),
    check('amenity_capacity_positive', sql`${t.capacity} > 0`),
  ],
);
export const amenitySlots = pgTable(
  'amenity_slots',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    amenityId: uuid('amenity_id').notNull(),
    startsAt: date('starts_at').notNull(),
    endsAt: date('ends_at').notNull(),
    capacity: integer('capacity').notNull(),
    reserved: integer('reserved').notNull().default(0),
  },
  (t) => [
    unique().on(t.societyId, t.id),
    unique().on(t.amenityId, t.startsAt),
    foreignKey({
      columns: [t.societyId, t.amenityId],
      foreignColumns: [amenities.societyId, amenities.id],
    }),
    check(
      'slot_capacity_valid',
      sql`${t.capacity} > 0 and ${t.reserved} >= 0 and ${t.reserved} <= ${t.capacity}`,
    ),
    check('slot_time_valid', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);
export const bookings = pgTable(
  'bookings',
  {
    id: key(),
    societyId: uuid('society_id').notNull(),
    slotId: uuid('slot_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['confirmed', 'cancelled'] })
      .notNull()
      .default('confirmed'),
    createdAt: created(),
  },
  (t) => [
    foreignKey({
      columns: [t.societyId, t.slotId],
      foreignColumns: [amenitySlots.societyId, amenitySlots.id],
    }),
    uniqueIndex('one_active_booking')
      .on(t.slotId, t.userId)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);
export const notices = pgTable(
  'notices',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    towerId: uuid('tower_id'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    category: text('category', { enum: ['announcement', 'maintenance', 'event'] }).notNull(),
    publishedAt: date('published_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.societyId, t.towerId],
      foreignColumns: [towers.societyId, towers.id],
    }),
  ],
);
export const staff = pgTable('staff', {
  id: key(),
  societyId: uuid('society_id')
    .notNull()
    .references(() => societies.id),
  name: text('name').notNull(),
  category: text('category', { enum: ['staff', 'provider'] }).notNull(),
  service: text('service').notNull(),
  phone: text('phone').notNull(),
  hours: text('hours').notNull(),
});
export const notifications = pgTable(
  'notifications',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    resourceId: uuid('resource_id'),
    createdAt: created(),
    readAt: date('read_at'),
  },
  (t) => [index('notification_inbox_idx').on(t.userId, t.societyId, t.createdAt)],
);
export const pushDevices = pgTable('push_devices', {
  id: key(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: created(),
});
export const outbox = pgTable(
  'outbox',
  {
    id: key(),
    notificationId: uuid('notification_id')
      .notNull()
      .unique()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    attempts: integer('attempts').notNull().default(0),
    availableAt: date('available_at').notNull().defaultNow(),
    lockedUntil: date('locked_until'),
    completedAt: date('completed_at'),
    lastError: text('last_error'),
    tickets: jsonb('tickets').$type<{ id: string; token: string }[]>(),
    submittedAt: date('submitted_at'),
  },
  (t) => [
    index('outbox_ready_idx')
      .on(t.availableAt)
      .where(sql`${t.completedAt} is null`),
  ],
);
export const auditEvents = pgTable(
  'audit_events',
  {
    id: key(),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceId: uuid('resource_id').notNull(),
    createdAt: created(),
  },
  (t) => [index('audit_society_idx').on(t.societyId, t.createdAt)],
);
export const deletionRequests = pgTable('deletion_requests', {
  id: key(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: created(),
});
