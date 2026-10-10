import { useNow } from '../lib/clock';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { CalendarCheck2, Clock3, Plus } from 'lucide-react-native';
import type { Amenity } from '@portl/contracts';
import { useOverview } from '../lib/api';
import { useAppStore } from '../lib/state';
import { day, time } from '../lib/format';
import { colors as c } from '../design/theme';
import { AmenityArt } from '../components/art';
import {
  Button,
  Card,
  Choices,
  Empty,
  PageTitle,
  Row,
  Screen,
  Sheet,
  Tag,
  Txt,
} from '../components/ui';
import { ActionForm, useAction, type FormKind } from './forms';
export default function AmenitiesScreen() {
  const { data } = useOverview(),
    { role } = useAppStore(),
    [tab, setTab] = useState('explore'),
    [selected, setSelected] = useState<Amenity | null>(null),
    [slotId, setSlotId] = useState(''),
    [form, setForm] = useState<FormKind | null>(null),
    [record, setRecord] = useState<Amenity | undefined>(),
    { run, pending } = useAction(),
    { width } = useWindowDimensions();
  const now = useNow();
  if (!data) return null;
  const current = data.amenities.find((a) => a.id === selected?.id),
    slots = current?.slots.filter((s) => Date.parse(s.startsAt) > now) ?? [];
  return (
    <>
      <Screen>
        <PageTitle
          eyebrow="Space to unwind"
          title="Find your little escape."
          subtitle="Move, play, or just slow down. It’s all close to home."
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Choices
            options={[
              { value: 'explore', label: 'Explore spaces' },
              { value: 'bookings', label: role === 'admin' ? 'Society bookings' : 'My bookings' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {role === 'admin' && (
            <Button
              compact
              title="Add"
              icon={Plus}
              onPress={() => {
                setRecord(undefined);
                setForm('amenity');
              }}
            />
          )}
        </Row>
        {tab === 'explore' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            {data.amenities.map((a) => (
              <Card key={a.id} style={{ width: width >= 700 ? '47%' : '100%', padding: 12 }}>
                <AmenityArt kind={a.kind} height={180} />
                <View style={{ padding: 9, paddingTop: 17, gap: 12 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt size={20} weight="semibold" style={{ letterSpacing: -0.6 }}>
                      {a.name}
                    </Txt>
                    <Tag>{a.slots.length ? 'Book a slot' : 'Coming soon'}</Tag>
                  </Row>
                  <Txt size={12} color={c.muted} numberOfLines={2}>
                    {a.description}
                  </Txt>
                  <Button
                    title={role === 'admin' ? 'View availability' : 'Find a time'}
                    variant="secondary"
                    onPress={() => {
                      setSelected(a);
                      setSlotId('');
                    }}
                  />
                </View>
              </Card>
            ))}
            {!data.amenities.length && (
              <Empty
                title="Room for something good"
                description="Your society’s shared spaces will be listed here."
              />
            )}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {data.bookings
              .filter((b) => b.status === 'confirmed' && Date.parse(b.endsAt) > now)
              .map((b) => (
                <Card key={b.id}>
                  <Row>
                    <CalendarCheck2 size={26} color={c.forest} />
                    <View style={{ flex: 1 }}>
                      <Txt weight="semibold">
                        {data.amenities.find((a) => a.id === b.amenityId)?.name ??
                          'Amenity booking'}
                      </Txt>
                      <Txt size={12} color={c.muted}>
                        {day(b.startsAt)} · {time(b.startsAt)} – {time(b.endsAt)}
                      </Txt>
                    </View>
                    <Tag>Confirmed</Tag>
                  </Row>
                  {Date.parse(b.startsAt) > now && (
                    <Button
                      title="Cancel booking"
                      variant="outline"
                      compact
                      loading={pending}
                      style={{ marginTop: 15 }}
                      onPress={() =>
                        void run(
                          { type: 'booking.cancel', id: b.id },
                          'Booking cancelled. The slot is available again.',
                        )
                      }
                    />
                  )}
                </Card>
              ))}
            {!data.bookings.some((b) => b.status === 'confirmed' && Date.parse(b.endsAt) > now) && (
              <Empty
                icon={CalendarCheck2}
                title="A little you-time awaits"
                description="Choose a shared space and reserve a slot. Your upcoming bookings will appear here."
                action={<Button title="Explore amenities" onPress={() => setTab('explore')} />}
              />
            )}
          </View>
        )}
      </Screen>
      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle="Choose your time. All times are in India Standard Time."
      >
        {selected && <AmenityArt kind={selected.kind} height={145} />}
        <Txt size={13} color={c.muted}>
          {selected?.description}
        </Txt>
        {slots.length ? (
          <View style={{ gap: 10 }}>
            {slots.map((s) => {
              const booked = data.bookings.some(
                (b) =>
                  b.slotId === s.id && b.userId === data.profile.id && b.status === 'confirmed',
              );
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  disabled={s.reserved >= s.capacity || booked}
                  onPress={() => setSlotId(s.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: slotId === s.id ? c.forest : c.line,
                    borderRadius: 14,
                    padding: 17,
                    backgroundColor: slotId === s.id ? c.sage : c.surface,
                    opacity: s.reserved >= s.capacity ? 0.5 : 1,
                  }}
                >
                  <Row>
                    <Clock3 size={18} color={c.forest} />
                    <View style={{ flex: 1 }}>
                      <Txt size={13} weight="semibold">
                        {day(s.startsAt)} · {time(s.startsAt)}
                      </Txt>
                      <Txt size={11} color={c.muted}>
                        Until {time(s.endsAt)}
                      </Txt>
                    </View>
                    <Tag>{booked ? 'Booked' : `${s.capacity - s.reserved} left`}</Tag>
                  </Row>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Empty
            title="More time, soon"
            description="Your administrator hasn’t opened any upcoming slots yet."
          />
        )}
        {role === 'resident' && !!slots.length && (
          <Button
            title="Confirm booking"
            disabled={!slotId}
            loading={pending}
            onPress={async () => {
              const result = await run(
                { type: 'booking.create', slotId },
                'All yours. Your booking is confirmed.',
              );
              if (result) {
                setSelected(null);
                setTab('bookings');
              }
            }}
          />
        )}
        {role === 'admin' && selected && (
          <Button
            title="Edit amenity"
            variant="secondary"
            onPress={() => {
              setRecord(selected);
              setSelected(null);
              setForm('amenity');
            }}
          />
        )}
        {role === 'admin' && (
          <Button
            title="Open a new slot"
            onPress={() => {
              setSelected(null);
              setRecord(undefined);
              setForm('slot');
            }}
          />
        )}
      </Sheet>
      {form && <ActionForm kind={form} data={data} record={record} onClose={() => setForm(null)} />}
    </>
  );
}
