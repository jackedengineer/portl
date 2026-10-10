import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowUpRight,
  CalendarDays,
  Coffee,
  Megaphone,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
  UserRoundPlus,
} from 'lucide-react-native';
import { useOverview } from '../lib/api';
import { useAppStore } from '../lib/state';
import { greeting, day } from '../lib/format';
import { colors as c } from '../design/theme';
import { AmenityArt, HomeArt } from '../components/art';
import {
  Button,
  Card,
  Empty,
  PageTitle,
  Row,
  Screen,
  SectionTitle,
  Tag,
  Txt,
} from '../components/ui';
import { ActionForm, type FormKind } from './forms';
import { VisitCard } from './visit-card';

export default function HomeScreen() {
  const { data, refetch, isRefetching } = useOverview(),
    { role } = useAppStore(),
    [form, setForm] = useState<FormKind | null>(null),
    { width } = useWindowDimensions();
  if (!data) return null;
  const large = width >= 1100,
    pending = data.visits.filter((v) => v.status === 'requested'),
    inside = data.visits.filter((v) => v.status === 'entered'),
    first = data.profile.name.split(' ')[0];
  const actions =
    role === 'resident'
      ? [
          {
            label: 'Invite guest',
            icon: UserRoundPlus,
            action: () => setForm('pass'),
            color: c.sage,
          },
          {
            label: 'Book amenity',
            icon: CalendarDays,
            action: () => router.push('/amenities'),
            color: c.peach,
          },
          {
            label: 'Gate history',
            icon: ShieldCheck,
            action: () => router.push('/visitors'),
            color: c.blue,
          },
          {
            label: 'Directory',
            icon: UsersRound,
            action: () => router.push('/community?tab=directory'),
            color: '#F0ECF5',
          },
        ]
      : role === 'guard'
        ? [
            {
              label: 'New visitor',
              icon: UserRoundPlus,
              action: () => setForm('visitor'),
              color: c.sage,
            },
            {
              label: 'Verify pass',
              icon: ScanLine,
              action: () => setForm('verify'),
              color: c.peach,
            },
            {
              label: 'Inside now',
              icon: ShieldCheck,
              action: () => router.push('/visitors?filter=inside'),
              color: c.blue,
            },
            {
              label: 'Directory',
              icon: UsersRound,
              action: () => router.push('/community?tab=directory'),
              color: '#F0ECF5',
            },
          ]
        : [
            {
              label: 'Invite resident',
              icon: UserRoundPlus,
              action: () => setForm('invite'),
              color: c.sage,
            },
            {
              label: 'Post notice',
              icon: Megaphone,
              action: () => setForm('notice'),
              color: c.peach,
            },
            {
              label: 'Manage homes',
              icon: UsersRound,
              action: () => router.push('/manage?tab=homes'),
              color: c.blue,
            },
            {
              label: 'Open a slot',
              icon: CalendarDays,
              action: () => setForm('slot'),
              color: '#F0ECF5',
            },
          ];
  return (
    <>
      <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
        <PageTitle
          eyebrow={
            role === 'guard'
              ? 'Your gate, in good hands'
              : role === 'admin'
                ? 'Community overview'
                : 'A little closer to home'
          }
          title={`${greeting()}, ${first}.`}
          subtitle={
            role === 'resident'
              ? 'A good day starts with a connected community.'
              : role === 'guard'
                ? 'Everything you need for a smooth shift.'
                : 'Here’s what’s happening in your society today.'
          }
        />
        <View style={{ flexDirection: large ? 'row' : 'column', gap: 26 }}>
          <View style={{ flex: large ? 1.45 : undefined, gap: 26 }}>
            {width < 900 && role === 'resident' && pending.length > 0 && (
              <View>
                <SectionTitle
                  title="At your gate"
                  action="View all"
                  onPress={() => router.push('/visitors')}
                />
                <View style={{ gap: 12 }}>
                  {pending.slice(0, 2).map((v) => (
                    <VisitCard key={v.id} visit={v} prominent />
                  ))}
                </View>
              </View>
            )}
            <View
              style={{
                backgroundColor: c.forest,
                borderRadius: 25,
                minHeight: 188,
                overflow: 'hidden',
                padding: 24,
                justifyContent: 'center',
              }}
            >
              <View style={{ maxWidth: '61%', zIndex: 1 }}>
                <Row style={{ gap: 6, marginBottom: 10 }}>
                  <Sparkles size={13} color={c.lime} />
                  <Txt size={9} color={c.lime} weight="semibold" style={{ letterSpacing: 1.8 }}>
                    {role === 'resident'
                      ? 'LIFE AT MAPLEWOOD'.replace(
                          'MAPLEWOOD',
                          data.society.name.split(' ')[0]!.toUpperCase(),
                        )
                      : role === 'guard'
                        ? 'MAIN GATE'
                        : 'YOUR COMMUNITY'}
                  </Txt>
                </Row>
                <Txt
                  size={width < 700 ? 23 : 27}
                  display
                  color="#FFFFFF"
                  style={{ letterSpacing: -0.4, lineHeight: 31 }}
                >
                  {role === 'resident'
                    ? width < 700
                      ? 'Home, beyond\nyour front door.'
                      : 'Home is more\nthan your front door.'
                    : role === 'guard'
                      ? 'A warm welcome.\nA safer community.'
                      : 'Good communities\nstart with you.'}
                </Txt>
                <Txt size={11} color="#C3D4C4" style={{ marginTop: 11, maxWidth: 185 }}>
                  {role === 'resident'
                    ? 'It’s the people, places and little moments in between.'
                    : `${data.society.name} · ${data.society.city}`}
                </Txt>
              </View>
              <View style={{ position: 'absolute', right: width < 700 ? -18 : -28, bottom: -5 }}>
                <HomeArt size={width < 700 ? 170 : 230} />
              </View>
            </View>
            <View>
              <SectionTitle
                title={role === 'resident' ? 'Make yourself at home' : 'Quick actions'}
              />
              <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                {actions.map((a) => (
                  <Pressable
                    accessibilityRole="button"
                    key={a.label}
                    onPress={a.action}
                    style={({ pressed }) => ({
                      flex: 1,
                      alignItems: 'center',
                      gap: 10,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: '100%',
                        maxWidth: 90,
                        height: 65,
                        borderRadius: 19,
                        backgroundColor: a.color,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <a.icon size={25} strokeWidth={1.5} color={c.forest} />
                    </View>
                    <Txt size={10} weight="medium" style={{ textAlign: 'center' }}>
                      {a.label}
                    </Txt>
                  </Pressable>
                ))}
              </Row>
            </View>
            {role === 'resident' ? (
              width >= 900 || pending.length === 0 ? (
                <View>
                  <SectionTitle
                    title="At your gate"
                    action="View all"
                    onPress={() => router.push('/visitors')}
                  />
                  {pending.length ? (
                    <View style={{ gap: 12 }}>
                      {pending.slice(0, 2).map((v) => (
                        <VisitCard key={v.id} visit={v} prominent />
                      ))}
                    </View>
                  ) : (
                    <Empty
                      title="All quiet at the gate"
                      description="We’ll let you know when someone arrives for you."
                    />
                  )}
                </View>
              ) : null
            ) : (
              <>
                <Row style={{ gap: 12 }}>
                  {[
                    { label: 'Awaiting approval', value: pending.length },
                    { label: 'Inside now', value: inside.length },
                    {
                      label: role === 'admin' ? 'Homes' : 'Approved',
                      value:
                        role === 'admin'
                          ? data.flats.length
                          : data.visits.filter((v) => v.status === 'approved').length,
                    },
                  ].map((s) => (
                    <Card key={s.label} style={{ flex: 1, padding: 15 }}>
                      <Txt size={28} weight="semibold">
                        {s.value.toString().padStart(2, '0')}
                      </Txt>
                      <Txt size={10} color={c.muted}>
                        {s.label}
                      </Txt>
                    </Card>
                  ))}
                </Row>
                {role === 'guard' ? (
                  <View>
                    <SectionTitle
                      title="Ready for entry"
                      action="Gate log"
                      onPress={() => router.push('/visitors')}
                    />
                    <View style={{ gap: 12 }}>
                      {data.visits
                        .filter((v) => v.status === 'approved')
                        .map((v) => (
                          <VisitCard key={v.id} visit={v} />
                        ))}
                      {!data.visits.some((v) => v.status === 'approved') && (
                        <Empty
                          title="No entries waiting"
                          description="Approved visitors appear here, ready for you to check in."
                        />
                      )}
                    </View>
                  </View>
                ) : (
                  <Card style={{ backgroundColor: c.peach, borderWidth: 0 }}>
                    <Row>
                      <UsersRound size={24} color={c.coral} />
                      <View style={{ flex: 1 }}>
                        <Txt weight="semibold">
                          {data.joinRequests.filter((r) => r.status === 'pending').length} residents
                          waiting to join
                        </Txt>
                        <Txt size={12} color={c.muted}>
                          A quick review brings them home.
                        </Txt>
                      </View>
                    </Row>
                    <Button
                      title="Review requests"
                      variant="outline"
                      style={{ marginTop: 18 }}
                      onPress={() => router.push('/manage')}
                    />
                  </Card>
                )}
              </>
            )}
          </View>
          <View style={{ flex: large ? 1 : undefined, gap: 26 }}>
            <View>
              <SectionTitle
                title="Around the community"
                action="Notice board"
                onPress={() => router.push('/community')}
              />
              {data.notices[0] ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/community')}>
                  <Card style={{ backgroundColor: '#F0F2E8', borderWidth: 0, padding: 22 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Tag tone="sage">{data.notices[0].category.toUpperCase()}</Tag>
                      <Txt color={c.muted} size={10}>
                        {day(data.notices[0].publishedAt)}
                      </Txt>
                    </Row>
                    <Row style={{ alignItems: 'flex-start', marginTop: 20 }}>
                      <View style={{ flex: 1 }}>
                        <Txt size={23} display style={{ letterSpacing: -0.4 }}>
                          {data.notices[0].title}
                        </Txt>
                        <Txt numberOfLines={3} color={c.muted} size={12} style={{ marginTop: 9 }}>
                          {data.notices[0].body}
                        </Txt>
                      </View>
                      <View
                        style={{
                          height: 64,
                          width: 64,
                          borderRadius: 32,
                          backgroundColor: '#E2E7D2',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Coffee color="#78865A" size={30} strokeWidth={1.3} />
                      </View>
                    </Row>
                    <Row style={{ marginTop: 20, gap: 6 }}>
                      <Txt weight="semibold" size={11} color={c.forest}>
                        Read the update
                      </Txt>
                      <ArrowUpRight size={15} color={c.forest} />
                    </Row>
                  </Card>
                </Pressable>
              ) : (
                <Empty title="Room for good news" description="Society updates will appear here." />
              )}
            </View>
            {role !== 'guard' && (
              <View>
                <SectionTitle
                  title="A little time for you"
                  action="Explore"
                  onPress={() => router.push('/amenities')}
                />
                <Row style={{ alignItems: 'stretch' }}>
                  {data.amenities.slice(0, 2).map((a) => (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Book ${a.name}`}
                      onPress={() => router.push('/amenities')}
                      style={{ flex: 1 }}
                    >
                      <AmenityArt kind={a.kind} height={125} />
                      <Txt weight="semibold" size={13} style={{ marginTop: 11 }}>
                        {a.name}
                      </Txt>
                      <Txt size={10} color={c.muted} style={{ marginTop: 3 }}>
                        {a.slots.length ? 'Find your next open slot' : 'New slots coming soon'}
                      </Txt>
                    </Pressable>
                  ))}
                </Row>
              </View>
            )}
            <Row style={{ justifyContent: 'center', marginTop: 5, gap: 7 }}>
              <View style={{ height: 1, flex: 1, backgroundColor: c.line }} />
              <Txt size={10} color={c.muted}>
                a community that feels like home
              </Txt>
              <View style={{ height: 1, flex: 1, backgroundColor: c.line }} />
            </Row>
          </View>
        </View>
      </Screen>
      {form && <ActionForm kind={form} data={data} onClose={() => setForm(null)} />}
    </>
  );
}
