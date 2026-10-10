import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Building2, Check, Plus, UsersRound, X } from 'lucide-react-native';
import { useOverview } from '../lib/api';
import { useAppStore } from '../lib/state';
import { colors as c } from '../design/theme';
import {
  Button,
  Card,
  Choices,
  Empty,
  PageTitle,
  Row,
  Screen,
  SearchInput,
  SectionTitle,
  Tag,
  Txt,
} from '../components/ui';
import { ActionForm, useAction, type FormKind } from './forms';
export default function ManageScreen() {
  const params = useLocalSearchParams<{ tab?: string }>(),
    [tab, setTab] = useState(params.tab ?? 'people'),
    [search, setSearch] = useState(''),
    [form, setForm] = useState<FormKind | null>(null),
    { role } = useAppStore(),
    { data } = useOverview(),
    { run, pending } = useAction();
  if (role !== 'admin') return <Redirect href="/" />;
  if (!data) return null;
  const requests = data.joinRequests.filter((r) => r.status === 'pending');
  return (
    <>
      <Screen>
        <PageTitle
          eyebrow="Society administration"
          title="Keep things running well."
          subtitle="A little organisation makes everyone feel at home."
        />
        <Choices
          options={[
            { value: 'people', label: 'People' },
            { value: 'homes', label: 'Towers & flats' },
            { value: 'spaces', label: 'Spaces' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'people' ? (
          <>
            <Button
              title="Assign a guard or admin role"
              variant="secondary"
              onPress={() => setForm('role')}
            />
            {requests.length > 0 && (
              <View>
                <SectionTitle title="Waiting to join" />
                <View style={{ gap: 12 }}>
                  {requests.map((r) => (
                    <Card key={r.id} style={{ backgroundColor: c.peach, borderColor: '#EAD8C9' }}>
                      <Row>
                        <View style={{ flex: 1 }}>
                          <Txt weight="semibold" size={16}>
                            {r.name}
                          </Txt>
                          <Txt size={12} color={c.muted}>
                            {r.email}
                          </Txt>
                          <Txt size={12} style={{ marginTop: 6 }}>
                            {r.tower} · {r.flatNumber}
                          </Txt>
                        </View>
                        <Tag tone="peach">Needs review</Tag>
                      </Row>
                      <Row style={{ marginTop: 17 }}>
                        <Button
                          title="Decline"
                          icon={X}
                          variant="outline"
                          style={{ flex: 1 }}
                          loading={pending}
                          onPress={() =>
                            void run(
                              { type: 'join.decide', id: r.id, decision: 'rejected' },
                              'Join request declined.',
                            )
                          }
                        />
                        <Button
                          title="Approve"
                          icon={Check}
                          style={{ flex: 1 }}
                          loading={pending}
                          onPress={() =>
                            void run(
                              { type: 'join.decide', id: r.id, decision: 'approved' },
                              'Resident approved. Welcome to the community.',
                            )
                          }
                        />
                      </Row>
                    </Card>
                  ))}
                </View>
              </View>
            )}
            <Row>
              <View style={{ flex: 1 }}>
                <SearchInput value={search} onChangeText={setSearch} placeholder="Search members" />
              </View>
              <Button title="Invite" compact icon={Plus} onPress={() => setForm('invite')} />
            </Row>
            <View style={{ gap: 12 }}>
              {data.members
                .filter((m) =>
                  `${m.name} ${m.email} ${m.homeLabel}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((m) => (
                  <Card key={m.id}>
                    <Row>
                      <UsersRound size={23} color={c.forest} />
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold">{m.name}</Txt>
                        <Txt size={11} color={c.muted}>
                          {m.homeLabel || m.roles.join(', ')}
                        </Txt>
                      </View>
                      <Tag tone={m.status === 'active' ? 'sage' : 'danger'}>{m.status}</Tag>
                    </Row>
                    <Txt size={12} color={c.muted} style={{ marginTop: 10 }}>
                      {m.email}
                    </Txt>
                    <Button
                      title={m.status === 'active' ? 'Suspend access' : 'Restore access'}
                      variant="outline"
                      compact
                      loading={pending}
                      style={{ marginTop: 14 }}
                      onPress={() =>
                        void run(
                          {
                            type: 'member.status',
                            id: m.id,
                            status: m.status === 'active' ? 'suspended' : 'active',
                          },
                          'Member access updated.',
                        )
                      }
                    />
                  </Card>
                ))}
            </View>
          </>
        ) : tab === 'homes' ? (
          <>
            <Row>
              <Button
                title="Add tower"
                icon={Plus}
                style={{ flex: 1 }}
                onPress={() => setForm('tower')}
              />
              <Button
                title="Add flat"
                icon={Plus}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={!data.towers.length}
                onPress={() => setForm('flat')}
              />
            </Row>
            <View style={{ gap: 16 }}>
              {data.towers.map((t) => (
                <Card key={t.id}>
                  <Row>
                    <Building2 color={c.forest} size={25} />
                    <Txt size={18} weight="semibold" style={{ flex: 1 }}>
                      {t.name}
                    </Txt>
                    <Tag>{data.flats.filter((f) => f.towerId === t.id).length} homes</Tag>
                  </Row>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 }}>
                    {data.flats
                      .filter((f) => f.towerId === t.id)
                      .map((f) => (
                        <View
                          key={f.id}
                          style={{
                            paddingHorizontal: 17,
                            paddingVertical: 12,
                            borderRadius: 11,
                            backgroundColor: c.background,
                          }}
                        >
                          <Txt weight="medium" size={13}>
                            {f.number}
                          </Txt>
                        </View>
                      ))}
                  </View>
                </Card>
              ))}
              {!data.towers.length && (
                <Empty
                  title="Start with your first tower"
                  description="Then add flats, and invite the people who call them home."
                />
              )}
            </View>
          </>
        ) : (
          <>
            <Row>
              <Button
                title="Add amenity"
                icon={Plus}
                style={{ flex: 1 }}
                onPress={() => setForm('amenity')}
              />
              <Button
                title="Open slot"
                icon={Plus}
                variant="secondary"
                style={{ flex: 1 }}
                disabled={!data.amenities.length}
                onPress={() => setForm('slot')}
              />
            </Row>
            {data.amenities.map((a) => (
              <Card key={a.id}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <Txt size={18} weight="semibold">
                      {a.name}
                    </Txt>
                    <Txt color={c.muted} size={12}>
                      {a.capacity} bookings per slot · {a.slots.length} upcoming slots
                    </Txt>
                  </View>
                  <Tag>{a.kind}</Tag>
                </Row>
                <Txt size={13} color={c.muted} style={{ marginTop: 12 }}>
                  {a.description}
                </Txt>
              </Card>
            ))}
          </>
        )}
      </Screen>
      {form && <ActionForm kind={form} data={data} onClose={() => setForm(null)} />}
    </>
  );
}
