import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Overview, Role } from '@portl/contracts';
import { amenityInput, noticeInput, passInput, staffInput, visitInput } from '@portl/contracts';
import {
  assertBookingAvailable,
  assertOwnFlat,
  checkPassWindow,
  DomainError,
  requireRole,
  transitionVisit,
} from '@portl/domain';
import { createDemoOverview, demoId, demoUsers } from '@portl/domain/demo';
import type { Command, CommandResult } from './commands';

const key = 'portl-demo-v1';
let state: Overview | null = null;
let tokens: Record<string, string> = {};
let chain = Promise.resolve<unknown>(null);
const uuid = () => Crypto.randomUUID();
async function load() {
  if (!state) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        state = data.state;
        tokens = data.tokens ?? {};
      }
    } catch {
      /* A resettable fictional demo must still open if storage is unavailable. */
    }
    state ??= createDemoOverview();
  }
  return state;
}
export async function resetDemo() {
  state = createDemoOverview();
  tokens = {};
  await AsyncStorage.removeItem(key);
}
export async function demoOverview(role: Role): Promise<Overview> {
  const original = await load();
  const data = JSON.parse(JSON.stringify(original)) as Overview;
  data.profile = {
    ...demoUsers[role],
    memberships: [
      {
        id: demoId(role === 'resident' ? 20 : role === 'guard' ? 21 : 22),
        society: data.society,
        roles: [role],
        flatIds: role === 'resident' ? [demoId(40)] : [],
        homeLabel:
          role === 'resident'
            ? 'Tower A · 1204'
            : role === 'guard'
              ? 'Main gate'
              : 'Society office',
      },
    ],
  };
  data.generatedAt = new Date().toISOString();
  data.visits = data.visits.map((v) => ({
    ...v,
    status:
      ['requested', 'approved'].includes(v.status) && Date.parse(v.expiresAt) < Date.now()
        ? 'expired'
        : v.status,
  }));
  if (role === 'resident') {
    data.visits = data.visits.filter((v) => v.flatId === demoId(40));
    data.passes = data.passes.filter((p) => p.flatId === demoId(40));
    data.flats = data.flats.filter((f) => f.id === demoId(40));
    data.bookings = data.bookings.filter((b) => b.userId === demoUsers.resident.id);
  }
  if (role !== 'admin') {
    data.members =
      role === 'guard'
        ? data.members.filter((m) => m.roles.includes('resident')).map((m) => ({ ...m, email: '' }))
        : [];
    data.joinRequests = [];
  }
  return data;
}
export async function demoCommand(role: Role, command: Command): Promise<CommandResult> {
  const operation = chain.then(async () => {
    const current = await load();
    const d = JSON.parse(JSON.stringify(current)) as Overview;
    const now = new Date().toISOString();
    let result: CommandResult = {};
    const flatLabel = (id: string) => {
      const f = d.flats.find((f) => f.id === id);
      if (!f) throw new Error('Choose an available flat.');
      return `${f.towerName} · ${f.number}`;
    };
    switch (command.type) {
      case 'visit.create': {
        requireRole(role, ['guard']);
        const input = visitInput.parse(command.input);
        d.visits.unshift({
          id: input.requestId,
          ...input,
          flatLabel: flatLabel(input.flatId),
          status: 'requested',
          requestedAt: now,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          enteredAt: null,
          exitedAt: null,
          decidedBy: null,
        });
        break;
      }
      case 'visit.action': {
        const v = d.visits.find((v) => v.id === command.id);
        if (!v) throw new Error('Visit not found.');
        assertOwnFlat(role, [demoId(40)], v.flatId);
        v.status = transitionVisit(v.status, command.action, role, new Date(v.expiresAt));
        if (['approve', 'reject'].includes(command.action)) v.decidedBy = demoUsers[role].id;
        if (command.action === 'enter') v.enteredAt = now;
        if (command.action === 'exit') v.exitedAt = now;
        break;
      }
      case 'pass.create': {
        requireRole(role, ['resident']);
        const input = passInput.parse(command.input);
        const id = uuid();
        const token = Crypto.randomUUID().replaceAll('-', '');
        tokens[token] = id;
        d.passes.unshift({
          id,
          ...input,
          flatLabel: flatLabel(input.flatId),
          status: 'active',
          createdBy: demoUsers[role].id,
        });
        result = { id, token };
        break;
      }
      case 'pass.revoke': {
        requireRole(role, ['resident', 'admin']);
        const p = d.passes.find((p) => p.id === command.id);
        if (!p || p.status !== 'active') throw new Error('This pass is no longer active.');
        assertOwnFlat(role, [demoId(40)], p.flatId);
        p.status = 'revoked';
        break;
      }
      case 'pass.redeem': {
        requireRole(role, ['guard']);
        const p = d.passes.find((p) => p.id === tokens[command.token]);
        if (!p || p.status !== 'active')
          throw new Error('This pass is invalid or has already been used.');
        checkPassWindow(new Date(p.validFrom), new Date(p.validUntil));
        p.status = 'used';
        d.visits.unshift({
          id: uuid(),
          name: p.name,
          kind: 'guest',
          company: '',
          note: p.note,
          flatId: p.flatId,
          flatLabel: p.flatLabel,
          status: 'approved',
          requestedAt: now,
          expiresAt: p.validUntil,
          enteredAt: null,
          exitedAt: null,
          decidedBy: p.createdBy,
        });
        break;
      }
      case 'booking.create': {
        requireRole(role, ['resident']);
        const a = d.amenities.find((a) => a.slots.some((s) => s.id === command.slotId));
        const s = a?.slots.find((s) => s.id === command.slotId);
        if (!a || !s) throw new Error('Slot not found.');
        if (
          d.bookings.some(
            (b) => b.slotId === s.id && b.userId === demoUsers[role].id && b.status === 'confirmed',
          )
        )
          break;
        assertBookingAvailable(s.capacity, s.reserved, new Date(s.startsAt));
        s.reserved++;
        d.bookings.unshift({
          id: uuid(),
          amenityId: a.id,
          slotId: s.id,
          userId: demoUsers[role].id,
          status: 'confirmed',
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        });
        break;
      }
      case 'booking.cancel': {
        requireRole(role, ['resident', 'admin']);
        const b = d.bookings.find((b) => b.id === command.id);
        if (!b || b.status !== 'confirmed') break;
        if (Date.parse(b.startsAt) <= Date.now())
          throw new Error('This booking has already started.');
        if (role === 'resident' && b.userId !== demoUsers.resident.id)
          throw new Error('This is another resident’s booking.');
        b.status = 'cancelled';
        const s = d.amenities.flatMap((a) => a.slots).find((s) => s.id === b.slotId);
        if (s) s.reserved--;
        break;
      }
      case 'notice.save': {
        requireRole(role, ['admin']);
        const input = noticeInput.parse(command.input);
        if (command.id) {
          const n = d.notices.find((n) => n.id === command.id);
          if (n) Object.assign(n, input);
        } else d.notices.unshift({ id: uuid(), ...input, publishedAt: now });
        break;
      }
      case 'notice.delete':
        requireRole(role, ['admin']);
        d.notices = d.notices.filter((n) => n.id !== command.id);
        break;
      case 'staff.save': {
        requireRole(role, ['admin']);
        const input = staffInput.parse(command.input);
        if (command.id) {
          const s = d.staff.find((s) => s.id === command.id);
          if (s) Object.assign(s, input);
        } else d.staff.push({ id: uuid(), ...input });
        break;
      }
      case 'staff.delete':
        requireRole(role, ['admin']);
        d.staff = d.staff.filter((s) => s.id !== command.id);
        break;
      case 'tower.create':
        requireRole(role, ['admin']);
        if (!command.name.trim()) throw new Error('Enter a tower name.');
        d.towers.push({ id: uuid(), name: command.name });
        break;
      case 'flat.create': {
        requireRole(role, ['admin']);
        const t = d.towers.find((t) => t.id === command.towerId);
        if (!t) throw new Error('Choose a tower.');
        if (d.flats.some((f) => f.towerId === t.id && f.number === command.number))
          throw new Error('That flat already exists.');
        d.flats.push({ id: uuid(), towerId: t.id, towerName: t.name, number: command.number });
        break;
      }
      case 'amenity.save': {
        requireRole(role, ['admin']);
        const input = amenityInput.parse(command.input);
        if (command.id) {
          const a = d.amenities.find((a) => a.id === command.id);
          if (a) Object.assign(a, input);
        } else d.amenities.push({ id: uuid(), ...input, slots: [] });
        break;
      }
      case 'slot.create': {
        requireRole(role, ['admin']);
        const a = d.amenities.find((a) => a.id === command.amenityId);
        if (!a) throw new Error('Amenity not found.');
        const from = Date.parse(command.startsAt),
          to = Date.parse(command.endsAt);
        if (
          !Number.isFinite(from) ||
          from <= Date.now() ||
          to <= from ||
          command.capacity > a.capacity
        )
          throw new Error('Check the future time window and capacity.');
        if (a.slots.some((s) => Date.parse(s.startsAt) < to && Date.parse(s.endsAt) > from))
          throw new Error('This slot overlaps another.');
        a.slots.push({
          id: uuid(),
          startsAt: command.startsAt,
          endsAt: command.endsAt,
          capacity: command.capacity,
          reserved: 0,
        });
        break;
      }
      case 'member.grant': {
        requireRole(role, ['admin']);
        const member = d.members.find((m) => m.email.toLowerCase() === command.email.toLowerCase());
        if (!member) throw new Error('Use an existing demo member’s email.');
        if (!member.roles.includes(command.role)) member.roles.push(command.role);
        break;
      }
      case 'member.status': {
        requireRole(role, ['admin']);
        const m = d.members.find((m) => m.id === command.id);
        if (m) {
          if (m.roles.includes('admin') && command.status === 'suspended')
            throw new Error('Keep at least one active administrator.');
          m.status = command.status;
        }
        break;
      }
      case 'join.decide': {
        requireRole(role, ['admin']);
        const r = d.joinRequests.find((r) => r.id === command.id);
        if (!r || r.status !== 'pending')
          throw new Error('This request has already been reviewed.');
        const f = d.flats.find((f) => f.towerName === r.tower && f.number === r.flatNumber);
        if (command.decision === 'approved' && !f)
          throw new Error('Create the matching flat first.');
        r.status = command.decision;
        if (command.decision === 'approved')
          d.members.push({
            id: uuid(),
            name: r.name,
            email: r.email,
            homeLabel: `${r.tower} · ${r.flatNumber}`,
            roles: ['resident'],
            status: 'active',
          });
        break;
      }
      case 'notification.read':
        d.notifications.forEach((n) => {
          n.readAt = now;
        });
        break;
      case 'invite.create':
        requireRole(role, ['admin']);
        result = {
          token: `demo-${uuid()}`,
          message: 'Demo invitation created. It does not send an email.',
        };
        break;
      default:
        throw new DomainError('UNKNOWN_ACTION', 'This action is unavailable.');
    }
    state = d;
    await AsyncStorage.setItem(key, JSON.stringify({ state: d, tokens }));
    return result;
  });
  chain = operation.catch(() => null);
  return operation;
}
