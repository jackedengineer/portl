import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, ShieldCheck } from 'lucide-react-native';
import { roleLabels } from '@portl/contracts';
import { authClient } from '../../lib/auth';
import { apiRequest, loadProfile, useOverview } from '../../lib/api';
import { useAppStore, useToast } from '../../lib/state';
import { resetDemo } from '../../lib/demo';
import { enablePush, unregisterPush } from '../../lib/push';
import { initials } from '../../lib/format';
import { colors as c } from '../../design/theme';
import { Button, Card, Input, PageTitle, Row, Screen, Sheet, Tag, Txt } from '../../components/ui';
export default function Account() {
  const { data } = useOverview(),
    store = useAppStore(),
    cache = useQueryClient(),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [editing, setEditing] = useState(false),
    toast = useToast();
  if (!data) return null;
  async function attempt(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Screen>
        <PageTitle eyebrow="Your space" title="Make yourself comfortable." />
        <Card>
          <Row>
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 22,
                backgroundColor: c.sage,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Txt size={23} weight="semibold">
                {initials(data.profile.name)}
              </Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={22} weight="semibold">
                {data.profile.name}
              </Txt>
              <Txt size={12} color={c.muted}>
                {data.profile.email}
              </Txt>
            </View>
          </Row>
          <View style={{ marginTop: 20 }}>
            <Tag>
              {roleLabels[store.role]}
              {store.mode === 'demo' ? ' · Fictional demo' : ''}
            </Tag>
          </View>
          {store.mode === 'live' && (
            <Button
              title="Edit your name"
              variant="outline"
              compact
              style={{ marginTop: 16 }}
              onPress={() => {
                setName(data.profile.name);
                setEditing(true);
              }}
            />
          )}
        </Card>
        <Card style={{ gap: 16 }}>
          <Row>
            <Bell size={22} color={c.forest} />
            <Txt size={17} weight="semibold">
              Stay in the loop
            </Txt>
          </Row>
          <Txt size={13} color={c.muted}>
            Get a heads-up when someone arrives. Push previews keep visitor details private; open
            Portl to see the request.
          </Txt>
          <Button
            title={store.pushToken ? 'Notifications enabled' : 'Enable notifications'}
            variant="secondary"
            loading={busy}
            onPress={() =>
              void attempt(async () => {
                await enablePush();
                toast.show('Notifications enabled.');
              })
            }
          />
        </Card>
        <Card style={{ gap: 15 }}>
          <Row>
            <ShieldCheck size={22} color={c.forest} />
            <Txt size={17} weight="semibold">
              Privacy & account
            </Txt>
          </Row>
          <Button
            title="Privacy & your data"
            variant="outline"
            onPress={() => router.push('/privacy')}
          />
          {store.mode === 'demo' ? (
            <Button
              title="Reset demo data"
              variant="outline"
              loading={busy}
              onPress={() =>
                void attempt(async () => {
                  await resetDemo();
                  await cache.invalidateQueries({ queryKey: ['overview'] });
                  toast.show('The demo is ready for a fresh start.');
                })
              }
            />
          ) : (
            <Button title="Delete my account" variant="danger" onPress={() => setDeleting(true)} />
          )}
        </Card>
        <Button
          title={store.mode === 'demo' ? 'Leave demo · Go to sign in' : 'Sign out'}
          icon={LogOut}
          variant="outline"
          loading={busy}
          onPress={() =>
            void attempt(async () => {
              if (store.mode === 'live') {
                await unregisterPush();
                const result = await authClient.signOut();
                if (result.error) throw new Error(result.error.message);
              }
              store.leave();
              cache.clear();
              router.replace('/sign-in');
            })
          }
        />
        <Txt size={11} color={c.muted} style={{ textAlign: 'center' }}>
          Portl · Your community, closer.
        </Txt>
      </Screen>
      <Sheet
        visible={deleting}
        onClose={() => setDeleting(false)}
        title="Leave Portl?"
        subtitle="This permanently removes your account and memberships."
      >
        <Txt size={13} color={c.muted}>
          Your future bookings will be cancelled. Society movement and audit records may remain
          until their retention period ends, with your account link removed. The last society
          administrator must first assign a replacement.
        </Txt>
        <Input
          label="Type DELETE to confirm"
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
        />
        <Button
          title="Request permanent deletion"
          variant="danger"
          disabled={confirm !== 'DELETE'}
          loading={busy}
          onPress={() =>
            void attempt(async () => {
              await apiRequest('/v1/me/deletion', 'POST');
              await authClient.signOut();
              store.leave();
              cache.clear();
              setDeleting(false);
              router.replace('/sign-in');
              toast.show('Account deletion requested. Processing may take up to 30 days.');
            })
          }
        />
      </Sheet>
      <Sheet visible={editing} onClose={() => setEditing(false)} title="What should we call you?">
        <Input label="Full name" value={name} onChangeText={setName} />
        <Button
          title="Save name"
          loading={busy}
          onPress={() =>
            void attempt(async () => {
              await apiRequest('/v1/me', 'PATCH', { name });
              store.setProfile(await loadProfile());
              await cache.invalidateQueries({ queryKey: ['overview'] });
              setEditing(false);
              toast.show('Name updated.');
            })
          }
        />
      </Sheet>
    </>
  );
}
