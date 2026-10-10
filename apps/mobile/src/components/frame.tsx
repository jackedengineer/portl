import { usePushUpdates } from '../lib/use-push-updates';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, usePathname } from 'expo-router';
import {
  Bell,
  ChevronDown,
  Home,
  UsersRound,
  CalendarDays,
  LayoutGrid,
  Settings2,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { roleLabels, roles } from '@portl/contracts';
import { authClient } from '../lib/auth';
import { apiUrl, useAppStore, useToast } from '../lib/state';
import { loadProfile, useCommand, useOverview } from '../lib/api';
import { colors as c } from '../design/theme';
import { initials, relative } from '../lib/format';
import { PortlMark } from './art';
import { Button, Card, Empty, IconButton, Row, Sheet, Tag, Txt } from './ui';

export function Frame({ children }: { children: ReactNode }) {
  usePushUpdates();
  const { width } = useWindowDimensions(),
    wide = width >= 900;
  const store = useAppStore(),
    { data, isLoading, error, refetch } = useOverview(),
    command = useCommand(),
    cache = useQueryClient();
  const [chooser, setChooser] = useState(false),
    [inbox, setInbox] = useState(false),
    [checking, setChecking] = useState(store.mode === 'live' && !store.profile);
  const path = usePathname();
  useEffect(() => {
    if (store.mode === 'live' && !store.profile) {
      loadProfile()
        .then(store.setProfile)
        .catch(() => {})
        .finally(() => setChecking(false));
    }
  }, [store.mode, store.profile, store.setProfile]);
  useEffect(() => {
    if (store.mode !== 'live' || !store.societyId || !store.profile) return;
    let socket: ReturnType<typeof io> | undefined,
      cancelled = false;
    void (async () => {
      const cookie = Platform.OS === 'web' ? '' : await authClient.getCookie();
      if (cancelled) return;
      socket = io(apiUrl, {
        withCredentials: true,
        transports: ['websocket'],
        auth: { societyId: store.societyId, role: store.role },
        ...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
      });
      socket.on('refresh', () => cache.invalidateQueries({ queryKey: ['overview'] }));
    })().catch(() => {});
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [store.mode, store.societyId, store.profile, store.role, cache]);
  if (checking)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={c.forest} />
      </View>
    );
  if (store.mode === 'live' && !store.profile) return <Redirect href="/sign-in" />;
  if (store.mode === 'live' && !store.societyId) return <Redirect href="/join" />;
  const nav = [
    { path: '/', label: 'Home', icon: Home },
    {
      path: '/visitors',
      label: store.role === 'guard' ? 'Gate log' : 'Visitors',
      icon: UsersRound,
    },
    ...(store.role === 'guard'
      ? []
      : [{ path: '/amenities', label: 'Amenities', icon: CalendarDays }]),
    { path: '/community', label: 'Community', icon: LayoutGrid },
    ...(store.role === 'admin' ? [{ path: '/manage', label: 'Manage', icon: Settings2 }] : []),
  ];
  const navItems = nav.map((n) => {
    const active = path === n.path;
    return (
      <Pressable
        key={n.path}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={n.label}
        onPress={() => router.navigate(n.path as '/')}
        style={({ pressed }) => ({
          flex: wide ? undefined : 1,
          flexDirection: wide ? 'row' : 'column',
          alignItems: 'center',
          gap: wide ? 13 : 5,
          paddingHorizontal: wide ? 17 : 2,
          paddingVertical: 12,
          minHeight: wide ? 52 : 63,
          borderRadius: 14,
          backgroundColor: wide && active ? c.sage : pressed ? c.background : 'transparent',
        })}
      >
        <n.icon
          size={wide ? 20 : 21}
          color={active ? c.forest : c.muted}
          strokeWidth={active ? 2.2 : 1.6}
        />
        <Txt
          size={wide ? 13 : 10}
          weight={active ? 'semibold' : 'medium'}
          color={active ? c.forest : c.muted}
        >
          {n.label}
        </Txt>
        {wide && active && (
          <View
            style={{
              marginLeft: 'auto',
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: c.forest,
            }}
          />
        )}
      </Pressable>
    );
  });
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {wide && (
          <View
            style={{
              width: 232,
              borderRightWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface,
              padding: 22,
              gap: 32,
            }}
          >
            <Row style={{ marginTop: 12, paddingHorizontal: 10 }}>
              <PortlMark size={32} />
              <Txt size={30} weight="bold" style={{ letterSpacing: -1.6 }}>
                portl
                <Txt color={c.coral} size={30}>
                  .
                </Txt>
              </Txt>
            </Row>
            <View style={{ gap: 6 }}>{navItems}</View>
            <View style={{ marginTop: 'auto', gap: 20 }}>
              <Card style={{ backgroundColor: c.sage, borderWidth: 0, padding: 17 }}>
                <ShieldCheck size={23} color={c.forest} />
                <Txt weight="semibold" style={{ marginTop: 10 }}>
                  A little more connected.
                </Txt>
                <Txt size={11} color={c.muted} style={{ marginTop: 6 }}>
                  Your home. Your people. One community.
                </Txt>
              </Card>
              <Pressable onPress={() => router.push('/account')}>
                <Row>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      backgroundColor: c.peach,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Txt weight="semibold" color={c.coral}>
                      {initials(data?.profile.name ?? 'You')}
                    </Txt>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={12} weight="semibold">
                      {data?.profile.name ?? 'Your account'}
                    </Txt>
                    <Txt size={10} color={c.muted}>
                      {roleLabels[store.role]}
                    </Txt>
                  </View>
                  <ArrowUpRight size={16} color={c.muted} />
                </Row>
              </Pressable>
            </View>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Row
            style={{
              height: wide ? 86 : 75,
              paddingHorizontal: wide ? 32 : 22,
              borderBottomWidth: 1,
              borderColor: c.line,
              justifyContent: 'space-between',
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch society or role"
              style={{ flex: 1, minWidth: 0 }}
              onPress={() => setChooser(true)}
            >
              <Row style={{ gap: 10 }}>
                {!wide && <PortlMark size={29} />}
                <View style={{ flexShrink: 1 }}>
                  <Txt numberOfLines={1} size={13} weight="semibold">
                    {data?.society.name ?? 'Your community'}
                  </Txt>
                  <Row style={{ gap: 5 }}>
                    <Txt size={10} color={c.muted}>
                      {data?.profile.memberships.find((m) => m.society.id === store.societyId)
                        ?.homeLabel || roleLabels[store.role]}
                    </Txt>
                    <ChevronDown size={11} color={c.muted} />
                  </Row>
                </View>
              </Row>
            </Pressable>
            <Row style={{ gap: 4 }}>
              {store.mode === 'demo' && (
                <Pressable onPress={() => setChooser(true)}>
                  <Tag>DEMO</Tag>
                </Pressable>
              )}
              <IconButton
                icon={Bell}
                label="Notifications"
                badge={data?.notifications.some((n) => !n.readAt)}
                onPress={() => setInbox(true)}
              />
              {!wide && (
                <Pressable
                  accessibilityLabel="Your account"
                  onPress={() => router.push('/account')}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 13,
                    backgroundColor: c.peach,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={11} weight="semibold" color={c.coral}>
                    {initials(data?.profile.name ?? 'You')}
                  </Txt>
                </Pressable>
              )}
            </Row>
          </Row>
          {isLoading ? (
            <View style={{ padding: 24, gap: 18 }}>
              <Card style={{ height: 180, backgroundColor: c.sage }} />
              <Card style={{ height: 230 }}>
                <ActivityIndicator color={c.forest} />
              </Card>
            </View>
          ) : error ? (
            <View style={{ padding: 24, gap: 15 }}>
              <Empty
                title="Let’s reconnect"
                description={error.message}
                action={<Button title="Try again" onPress={() => void refetch()} />}
              />
              <Button
                title="Return to sign in"
                variant="outline"
                onPress={() => {
                  store.leave();
                  cache.clear();
                  router.replace('/sign-in');
                }}
              />
            </View>
          ) : (
            children
          )}
          {!wide && (
            <View
              style={{
                flexDirection: 'row',
                borderTopWidth: 1,
                borderColor: c.line,
                backgroundColor: c.surface,
                paddingHorizontal: 8,
              }}
            >
              {navItems}
            </View>
          )}
        </View>
      </View>
      <Sheet
        visible={chooser}
        onClose={() => setChooser(false)}
        title="Your community"
        subtitle={
          store.mode === 'demo'
            ? 'Explore each role with fictional sample data.'
            : 'Choose a society and your assigned role.'
        }
      >
        {store.mode === 'demo'
          ? roles.map((role) => (
              <Button
                key={role}
                title={roleLabels[role]}
                variant={store.role === role ? 'primary' : 'secondary'}
                onPress={() => {
                  store.enterDemo(role);
                  setChooser(false);
                  router.replace('/');
                }}
              />
            ))
          : store.profile?.memberships.map((m) => (
              <View key={m.id} style={{ gap: 10 }}>
                <Txt weight="semibold">{m.society.name}</Txt>
                {m.roles.map((role) => (
                  <Button
                    key={role}
                    title={roleLabels[role]}
                    variant="secondary"
                    onPress={() => {
                      store.setContext(m.society.id, role);
                      setChooser(false);
                      router.replace('/');
                    }}
                  />
                ))}
              </View>
            ))}
        {store.mode === 'live' && (
          <Button
            title="Join another society"
            variant="outline"
            onPress={() => {
              setChooser(false);
              router.push('/join');
            }}
          />
        )}
      </Sheet>
      <Sheet
        visible={inbox}
        onClose={() => setInbox(false)}
        title="Your updates"
        subtitle="The latest from your gate and community."
      >
        {data?.notifications.length ? (
          <>
            <Button
              title="Mark all as read"
              variant="secondary"
              loading={command.isPending}
              onPress={() =>
                command.mutate(
                  { type: 'notification.read' },
                  { onError: (e) => useToast.getState().show(e.message, 'error') },
                )
              }
            />
            {data.notifications.map((n) => (
              <Card
                key={n.id}
                style={{ backgroundColor: n.readAt ? c.surface : c.sage, borderWidth: 0 }}
              >
                <Row>
                  <Txt weight="semibold" style={{ flex: 1 }}>
                    {n.title}
                  </Txt>
                  {!n.readAt && (
                    <View
                      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.coral }}
                    />
                  )}
                </Row>
                <Txt size={12} color={c.muted} style={{ marginTop: 7 }}>
                  {n.body}
                </Txt>
                <Txt size={10} color={c.muted} style={{ marginTop: 10 }}>
                  {relative(n.createdAt)}
                </Txt>
              </Card>
            ))}
          </>
        ) : (
          <Empty title="You’re all caught up" description="New updates will appear here." />
        )}
      </Sheet>
    </SafeAreaView>
  );
}
