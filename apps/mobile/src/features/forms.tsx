import { useState } from 'react';
import { Share, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import {
  amenityInput,
  invitationInput,
  noticeInput,
  passInput,
  staffInput,
  visitInput,
  type Overview,
  type VisitKind,
  type Notice,
  type Staff,
  type Amenity,
} from '@portl/contracts';
import { useCommand } from '../lib/api';
import type { Command, CommandResult } from '../lib/commands';
import { useToast } from '../lib/state';
import { Button, Choices, Input, SearchInput, Sheet, Txt } from '../components/ui';
import { colors as c } from '../design/theme';
export type FormKind =
  | 'visitor'
  | 'pass'
  | 'verify'
  | 'notice'
  | 'staff'
  | 'tower'
  | 'flat'
  | 'amenity'
  | 'slot'
  | 'invite'
  | 'role';
export function useAction() {
  const command = useCommand(),
    toast = useToast();
  return {
    pending: command.isPending,
    run: async (input: Command, message: string) => {
      try {
        const result = await command.mutateAsync(input);
        toast.show(message);
        return result;
      } catch (error) {
        toast.show((error as Error).message, 'error');
        return null;
      }
    },
  };
}
const titles: Record<FormKind, string> = {
  visitor: 'Who’s at the gate?',
  pass: 'Expecting someone?',
  verify: 'Verify a guest pass',
  notice: 'Share an update',
  staff: 'Add to the directory',
  tower: 'Add a tower',
  flat: 'Add a flat',
  amenity: 'Add an amenity',
  slot: 'Open a booking slot',
  role: 'Assign a society role',
  invite: 'Invite a resident',
};
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const ist = (date: string, time: string) => {
  const value = new Date(`${date}T${time}:00+05:30`);
  if (Number.isNaN(value.getTime())) throw new Error('Enter a valid date and time.');
  return value.toISOString();
};
export function ActionForm({
  kind,
  data,
  onClose,
  record,
}: {
  kind: FormKind;
  data: Overview;
  onClose: () => void;
  record?: Notice | Staff | Amenity;
}) {
  const [requestId] = useState(() => Crypto.randomUUID());
  const { control, handleSubmit, setValue } = useForm<Record<string, string>>({
    defaultValues: {
      name: '',
      company: '',
      note: '',
      title: '',
      body: '',
      phone: '',
      service: '',
      hours: '',
      token: '',
      number: '',
      description: '',
      capacity: '1',
      email: '',
      date: today(),
      start: '09:00',
      end: '10:00',
      ...(record
        ? Object.fromEntries(
            Object.entries(record)
              .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
              .map(([key, value]) => [key, String(value)]),
          )
        : {}),
    },
  });
  const [visitorKind, setVisitorKind] = useState<VisitKind>('guest'),
    [flatId, setFlatId] = useState(data.flats[0]?.id ?? ''),
    [towerId, setTowerId] = useState(data.towers[0]?.id ?? ''),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(
      record &&
        'category' in record &&
        record.category !== 'staff' &&
        record.category !== 'provider'
        ? record.category
        : 'announcement',
    ),
    [assignedRole, setAssignedRole] = useState<'guard' | 'admin'>('guard'),
    [staffCategory, setStaffCategory] = useState<'staff' | 'provider'>(
      record &&
        'category' in record &&
        (record.category === 'staff' || record.category === 'provider')
        ? record.category
        : 'staff',
    ),
    [amenityKind, setAmenityKind] = useState<'pool' | 'gym' | 'court' | 'clubhouse'>(
      record && 'kind' in record ? record.kind : 'pool',
    ),
    [amenityId, setAmenityId] = useState(data.amenities[0]?.id ?? ''),
    [error, setError] = useState(''),
    [result, setResult] = useState<CommandResult | null>(null);
  const command = useCommand();
  const field = (key: string, label: string, placeholder: string, extra = {}) => (
    <Controller
      key={key}
      control={control}
      name={key}
      render={({ field: f }) => (
        <Input
          label={label}
          placeholder={placeholder}
          value={f.value ?? ''}
          onChangeText={f.onChange}
          onBlur={f.onBlur}
          {...extra}
        />
      )}
    />
  );
  const flatChoice = (
    <View style={{ gap: 9 }}>
      <Txt size={12} weight="semibold">
        Apartment
      </Txt>
      <Choices
        options={data.flats
          .filter(
            (f) =>
              !search ||
              `${f.towerName} ${f.number}`.toLowerCase().includes(search.toLowerCase()) ||
              data.members.some(
                (m) =>
                  m.name.toLowerCase().includes(search.toLowerCase()) &&
                  m.homeLabel.includes(`${f.towerName} · ${f.number}`),
              ),
          )
          .slice(0, 40)
          .map((f) => ({ value: f.id, label: `${f.towerName} · ${f.number}` }))}
        value={flatId}
        onChange={setFlatId}
      />
    </View>
  );
  const submit = async (v: Record<string, string>) => {
    setError('');
    try {
      let input: Command;
      switch (kind) {
        case 'visitor':
          input = {
            type: 'visit.create',
            input: visitInput.parse({
              requestId,
              name: v.name,
              company: v.company,
              note: v.note,
              kind: visitorKind,
              flatId,
            }),
          };
          break;
        case 'pass':
          input = {
            type: 'pass.create',
            input: passInput.parse({
              name: v.name,
              flatId,
              note: v.note,
              validFrom: new Date().toISOString(),
              validUntil: new Date(Date.now() + 12 * 3600000).toISOString(),
            }),
          };
          break;
        case 'verify':
          input = {
            type: 'pass.redeem',
            token: z.string().trim().min(20, 'Paste the complete guest pass code.').parse(v.token),
          };
          break;
        case 'notice':
          input = {
            type: 'notice.save',
            id: record?.id,
            input: noticeInput.parse({
              title: v.title,
              body: v.body,
              category,
              towerId: record && 'towerId' in record ? record.towerId : null,
            }),
          };
          break;
        case 'staff':
          input = {
            type: 'staff.save',
            id: record?.id,
            input: staffInput.parse({
              name: v.name,
              service: v.service,
              phone: v.phone,
              hours: v.hours,
              category: staffCategory,
            }),
          };
          break;
        case 'tower':
          input = { type: 'tower.create', name: z.string().trim().min(1).parse(v.name) };
          break;
        case 'flat':
          input = {
            type: 'flat.create',
            towerId,
            number: z.string().trim().min(1).parse(v.number),
          };
          break;
        case 'amenity':
          input = {
            type: 'amenity.save',
            id: record?.id,
            input: amenityInput.parse({
              name: v.name,
              description: v.description,
              capacity: Number(v.capacity),
              kind: amenityKind,
            }),
          };
          break;
        case 'slot':
          input = {
            type: 'slot.create',
            amenityId,
            startsAt: ist(v.date!, v.start!),
            endsAt: ist(v.date!, v.end!),
            capacity: z.number().int().min(1).max(100).parse(Number(v.capacity)),
          };
          break;
        case 'role':
          input = { type: 'member.grant', email: z.email().parse(v.email), role: assignedRole };
          break;
        case 'invite':
          input = { type: 'invite.create', ...invitationInput.parse({ email: v.email, flatId }) };
          break;
      }
      const response = await command.mutateAsync(input);
      if (response.token) setResult(response);
      else {
        useToast
          .getState()
          .show(
            kind === 'visitor'
              ? 'Approval request sent to the household.'
              : kind === 'verify'
                ? 'Pass verified. The guest is ready for entry.'
                : 'Saved. Your community is up to date.',
          );
        onClose();
      }
    } catch (e) {
      setError(
        e instanceof z.ZodError
          ? (e.issues[0]?.message ?? 'Check the entered values.')
          : (e as Error).message,
      );
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title={
        result
          ? kind === 'pass'
            ? 'Your guest is welcome.'
            : 'Invitation ready'
          : record
            ? 'Edit details'
            : titles[kind]
      }
      subtitle={
        result
          ? 'Share this private code with the intended recipient.'
          : kind === 'pass'
            ? 'A single-use pass, valid for the next 12 hours.'
            : kind === 'visitor'
              ? 'The resident will receive an approval request.'
              : undefined
      }
    >
      {result ? (
        <>
          <Txt selectable style={{ backgroundColor: c.sage, padding: 18, borderRadius: 14 }}>
            {result.token}
          </Txt>
          <Txt size={12} color={c.muted}>
            {kind === 'pass'
              ? 'Ask your guest to show this code at the gate. Keep it private; it grants one approved entry.'
              : 'The recipient signs in with their invited email and enters this code on the Join society screen. Expires in 7 days.'}
          </Txt>
          <Button
            title="Share code"
            onPress={() => {
              void Share.share({
                message: `${kind === 'pass' ? 'Your Portl guest pass' : 'Your Portl society invitation'}: ${result.token}`,
              }).catch(() => setError('Could not open sharing. Copy the code above.'));
            }}
          />
          <Button title="Done" variant="secondary" onPress={onClose} />
        </>
      ) : (
        <>
          {kind === 'visitor' && (
            <Choices
              options={(['guest', 'delivery', 'cab', 'service'] as const).map((value) => ({
                value,
                label: value[0]!.toUpperCase() + value.slice(1),
              }))}
              value={visitorKind}
              onChange={setVisitorKind}
            />
          )}
          {['visitor', 'pass', 'staff', 'tower', 'amenity'].includes(kind) &&
            field(
              'name',
              kind === 'tower' ? 'Tower name' : kind === 'amenity' ? 'Amenity name' : 'Full name',
              kind === 'tower' ? 'e.g. Tower D' : 'Enter a name',
              { autoCapitalize: 'words' },
            )}
          {['visitor', 'invite'].includes(kind) && (
            <SearchInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search resident, tower or flat"
            />
          )}
          {['visitor', 'pass', 'invite'].includes(kind) && flatChoice}
          {kind === 'visitor' &&
            visitorKind !== 'guest' &&
            field('company', 'Company or service', 'e.g. Zepto, Uber, Urban Company')}
          {['visitor', 'pass'].includes(kind) &&
            field('note', 'A note for the gate (optional)', 'Anything the guard should know?')}
          {kind === 'verify' &&
            field('token', 'Guest pass code', 'Paste the code shared by the resident', {
              autoCapitalize: 'none',
              autoCorrect: false,
              multiline: true,
            })}
          {kind === 'role' && (
            <>
              <Choices
                options={[
                  { value: 'guard', label: 'Security guard' },
                  { value: 'admin', label: 'Society admin' },
                ]}
                value={assignedRole}
                onChange={setAssignedRole}
              />
              <Txt size={12} color={c.muted}>
                The person must sign in to Portl with this email first. An administrator can manage
                all records in this society.
              </Txt>
            </>
          )}
          {['invite', 'role'].includes(kind) &&
            field('email', 'Resident email', 'name@example.com', {
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            })}
          {kind === 'notice' && (
            <>
              <Choices
                options={(['announcement', 'maintenance', 'event'] as const).map((value) => ({
                  value,
                  label: value[0]!.toUpperCase() + value.slice(1),
                }))}
                value={category}
                onChange={setCategory}
              />
              {field('title', 'Title', 'A clear, helpful headline')}
              {field('body', 'Your update', 'What should your community know?', {
                multiline: true,
              })}
              <Txt size={12} color={c.muted}>
                Visible to everyone in this society.
              </Txt>
            </>
          )}
          {kind === 'staff' && (
            <>
              <Choices
                options={[
                  { value: 'staff', label: 'Society staff' },
                  { value: 'provider', label: 'Service provider' },
                ]}
                value={staffCategory}
                onChange={setStaffCategory}
              />
              {field('service', 'Service', 'e.g. Electrician')}
              {field('phone', 'Contact number', '+91', { keyboardType: 'phone-pad' })}
              {field('hours', 'Availability', 'e.g. Mon–Sat, 9 am–6 pm')}
            </>
          )}
          {kind === 'flat' && (
            <>
              <Choices
                options={data.towers.map((t) => ({ value: t.id, label: t.name }))}
                value={towerId}
                onChange={setTowerId}
              />
              {field('number', 'Flat number', 'e.g. 1204')}
            </>
          )}
          {kind === 'amenity' && (
            <>
              <Choices
                options={(['pool', 'gym', 'court', 'clubhouse'] as const).map((value) => ({
                  value,
                  label: value,
                }))}
                value={amenityKind}
                onChange={setAmenityKind}
              />
              {field('description', 'Description', 'Hours, rules and things to bring', {
                multiline: true,
              })}
              {field('capacity', 'Maximum bookings per slot', '1', { keyboardType: 'number-pad' })}
            </>
          )}
          {kind === 'slot' && (
            <>
              <Choices
                options={data.amenities.map((a) => ({ value: a.id, label: a.name }))}
                value={amenityId}
                onChange={(value) => {
                  setAmenityId(value);
                  setValue(
                    'capacity',
                    String(data.amenities.find((a) => a.id === value)?.capacity ?? 1),
                  );
                }}
              />
              {field('date', 'Date · YYYY-MM-DD', today())}
              {field('start', 'Start time · 24-hour IST', '09:00')}
              {field('end', 'End time · 24-hour IST', '10:00')}
              {field('capacity', 'Available bookings', '1', { keyboardType: 'number-pad' })}
            </>
          )}
          {!!error && (
            <Txt color={c.danger} size={12}>
              {error}
            </Txt>
          )}
          <Button
            title={
              kind === 'visitor'
                ? 'Send approval request'
                : kind === 'pass'
                  ? 'Create guest pass'
                  : kind === 'verify'
                    ? 'Verify pass'
                    : kind === 'notice'
                      ? 'Publish notice'
                      : kind === 'invite'
                        ? 'Create invitation'
                        : 'Save'
            }
            loading={command.isPending}
            onPress={() => void handleSubmit(submit)()}
          />
        </>
      )}
    </Sheet>
  );
}
