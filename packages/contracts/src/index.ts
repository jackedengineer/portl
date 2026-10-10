import { z } from 'zod';

export const roleSchema = z.enum(['resident', 'guard', 'admin']);
export const visitKindSchema = z.enum(['guest', 'delivery', 'cab', 'service']);
export const visitStatusSchema = z.enum([
  'requested',
  'approved',
  'rejected',
  'entered',
  'exited',
  'expired',
  'revoked',
]);
export const visitActionSchema = z.enum(['approve', 'reject', 'enter', 'exit', 'revoke']);
export type Role = z.infer<typeof roleSchema>;
export type VisitKind = z.infer<typeof visitKindSchema>;
export type VisitStatus = z.infer<typeof visitStatusSchema>;
export type VisitAction = z.infer<typeof visitActionSchema>;

const name = z.string().trim().min(2).max(100);
const id = z.uuid();
export const visitInput = z.object({
  requestId: id,
  name,
  kind: visitKindSchema,
  flatId: id,
  company: z.string().trim().max(80).default(''),
  note: z.string().trim().max(240).default(''),
});
export const passInput = z
  .object({
    name,
    flatId: id,
    validFrom: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    note: z.string().trim().max(240).default(''),
  })
  .refine((v) => Date.parse(v.validUntil) > Date.parse(v.validFrom), {
    message: 'The end time must be after the start time.',
    path: ['validUntil'],
  });
export const noticeInput = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(5).max(4000),
  category: z.enum(['announcement', 'maintenance', 'event']),
  towerId: id.nullable().default(null),
});
export const staffInput = z.object({
  name,
  category: z.enum(['staff', 'provider']),
  service: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,16}$/, 'Enter a valid phone number.'),
  hours: z.string().trim().min(2).max(100),
});
export const towerInput = z.object({ name: z.string().trim().min(1).max(40) });
export const flatInput = z.object({ towerId: id, number: z.string().trim().min(1).max(20) });
export const joinInput = z.object({
  societyCode: z.string().trim().min(4).max(20),
  tower: z.string().trim().min(1).max(40),
  flatNumber: z.string().trim().min(1).max(20),
});
export const invitationInput = z.object({ email: z.email().toLowerCase(), flatId: id });
export const amenityInput = z.object({
  name,
  description: z.string().trim().min(5).max(600),
  kind: z.enum(['pool', 'gym', 'court', 'clubhouse']),
  capacity: z.number().int().min(1).max(100),
});
export const slotInput = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    capacity: z.number().int().min(1).max(100),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    message: 'End time must follow start time.',
  });

export type VisitInput = z.input<typeof visitInput>;
export type PassInput = z.input<typeof passInput>;
export type NoticeInput = z.input<typeof noticeInput>;
export type StaffInput = z.input<typeof staffInput>;
export type AmenityInput = z.input<typeof amenityInput>;
export interface Society {
  id: string;
  name: string;
  code: string;
  city: string;
  timezone: string;
}
export interface Membership {
  id: string;
  society: Society;
  roles: Role[];
  flatIds: string[];
  homeLabel: string;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  memberships: Membership[];
}
export interface Tower {
  id: string;
  name: string;
}
export interface Flat {
  id: string;
  towerId: string;
  number: string;
  towerName: string;
}
export interface Visit {
  id: string;
  name: string;
  kind: VisitKind;
  company: string;
  note: string;
  flatId: string;
  flatLabel: string;
  status: VisitStatus;
  requestedAt: string;
  expiresAt: string;
  enteredAt: string | null;
  exitedAt: string | null;
  decidedBy: string | null;
}
export interface GuestPass {
  id: string;
  name: string;
  flatId: string;
  flatLabel: string;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'used' | 'revoked';
  createdBy: string;
  note: string;
}
export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reserved: number;
}
export interface Amenity {
  id: string;
  name: string;
  description: string;
  kind: 'pool' | 'gym' | 'court' | 'clubhouse';
  capacity: number;
  slots: Slot[];
}
export interface Booking {
  id: string;
  amenityId: string;
  slotId: string;
  userId: string;
  status: 'confirmed' | 'cancelled';
  startsAt: string;
  endsAt: string;
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  category: 'announcement' | 'maintenance' | 'event';
  publishedAt: string;
  towerId: string | null;
}
export interface Staff {
  id: string;
  name: string;
  category: 'staff' | 'provider';
  service: string;
  phone: string;
  hours: string;
}
export interface JoinRequest {
  id: string;
  name: string;
  email: string;
  tower: string;
  flatNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
export interface Member {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  homeLabel: string;
  status: 'active' | 'suspended';
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  resourceId: string | null;
}
export interface Overview {
  society: Society;
  profile: Profile;
  generatedAt: string;
  towers: Tower[];
  flats: Flat[];
  visits: Visit[];
  passes: GuestPass[];
  amenities: Amenity[];
  bookings: Booking[];
  notices: Notice[];
  staff: Staff[];
  joinRequests: JoinRequest[];
  members: Member[];
  notifications: Notification[];
}
export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string; fields?: Record<string, string[]> };
}
export const roles: Role[] = ['resident', 'guard', 'admin'];
export const roleLabels: Record<Role, string> = {
  resident: 'Resident',
  guard: 'Security',
  admin: 'Society admin',
};
export const kindLabels: Record<VisitKind, string> = {
  guest: 'Guest',
  delivery: 'Delivery',
  cab: 'Cab',
  service: 'Service',
};
