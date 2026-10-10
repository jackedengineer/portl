import type {
  AmenityInput,
  NoticeInput,
  PassInput,
  StaffInput,
  VisitAction,
  VisitInput,
} from '@portl/contracts';

export type Command =
  | { type: 'visit.create'; input: VisitInput }
  | { type: 'visit.action'; id: string; action: VisitAction }
  | { type: 'pass.create'; input: PassInput }
  | { type: 'pass.revoke'; id: string }
  | { type: 'pass.redeem'; token: string }
  | { type: 'booking.create'; slotId: string }
  | { type: 'booking.cancel'; id: string }
  | { type: 'notice.save'; id?: string; input: NoticeInput }
  | { type: 'notice.delete'; id: string }
  | { type: 'staff.save'; id?: string; input: StaffInput }
  | { type: 'staff.delete'; id: string }
  | { type: 'tower.create'; name: string }
  | { type: 'flat.create'; towerId: string; number: string }
  | { type: 'amenity.save'; id?: string; input: AmenityInput }
  | { type: 'slot.create'; amenityId: string; startsAt: string; endsAt: string; capacity: number }
  | { type: 'member.grant'; email: string; role: 'guard' | 'admin' }
  | { type: 'member.status'; id: string; status: 'active' | 'suspended' }
  | { type: 'join.decide'; id: string; decision: 'approved' | 'rejected' }
  | { type: 'notification.read' }
  | { type: 'invite.create'; email: string; flatId: string };
export interface CommandResult {
  id?: string;
  token?: string;
  message?: string;
}
