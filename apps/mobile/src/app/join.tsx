import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest, loadProfile } from '../lib/api';
import { useAppStore, useToast } from '../lib/state';
import { Button, Card, Choices, Input, PageTitle, Screen, Tag, Txt } from '../components/ui';
import { colors as c } from '../design/theme';
export default function Join() {
  const store = useAppStore(),
    [tab, setTab] = useState('request'),
    [name, setName] = useState(store.profile?.name ?? ''),
    [code, setCode] = useState(''),
    [tower, setTower] = useState(''),
    [flat, setFlat] = useState(''),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [requests, setRequests] = useState<
      { id: string; status: string; society: string; tower: string; flatNumber: string }[]
    >([]);
  async function refresh() {
    try {
      store.setProfile(await loadProfile());
      setRequests(await apiRequest('/v1/me/requests'));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const setProfile = store.setProfile;
  useEffect(() => {
    let active = true;
    void Promise.all([loadProfile(), apiRequest<typeof requests>('/v1/me/requests')])
      .then(([profile, rows]) => {
        if (active) {
          setProfile(profile);
          setRequests(rows);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [setProfile]);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (name.trim().length < 2) throw new Error('Please enter your full name.');
      await apiRequest('/v1/me', 'PATCH', { name: name.trim() });
      if (tab === 'invite') {
        await apiRequest('/v1/invitations/accept', 'POST', { token: token.trim() });
        store.setProfile(await loadProfile());
        router.replace('/');
      } else {
        await apiRequest('/v1/join-requests', 'POST', {
          societyCode: code,
          tower,
          flatNumber: flat,
        });
        useToast.getState().show('Request sent. Your society admin will review it.');
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Screen>
        <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center', gap: 22 }}>
          <PageTitle
            eyebrow="Find your people"
            title="Welcome home."
            subtitle="Your society administrator helps connect you to the right home."
          />
          <Input
            label="Your full name"
            value={name}
            onChangeText={setName}
            placeholder="How should we call you?"
          />
          <Choices
            options={[
              { value: 'request', label: 'Request to join' },
              { value: 'invite', label: 'I have an invitation' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'invite' ? (
            <Input
              label="Private invitation code"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              placeholder="Paste the code from your admin"
              multiline
            />
          ) : (
            <>
              <Input
                label="Society code"
                value={code}
                onChangeText={setCode}
                placeholder="Ask your society admin"
                autoCapitalize="characters"
              />
              <Input
                label="Tower name"
                value={tower}
                onChangeText={setTower}
                placeholder="e.g. Tower A"
              />
              <Input
                label="Flat number"
                value={flat}
                onChangeText={setFlat}
                placeholder="e.g. 1204"
              />
            </>
          )}
          {!!error && <Txt color={c.danger}>{error}</Txt>}
          <Button
            title={tab === 'invite' ? 'Accept invitation' : 'Send join request'}
            loading={busy}
            onPress={() => void submit()}
          />
          {requests.map((r) => (
            <Card key={r.id}>
              <Txt weight="semibold">{r.society}</Txt>
              <Txt size={12} color={c.muted}>
                {r.tower} · {r.flatNumber}
              </Txt>
              <View style={{ marginTop: 10 }}>
                <Tag>{r.status}</Tag>
              </View>
            </Card>
          ))}
          <Button
            title="Refresh approval status"
            variant="secondary"
            onPress={async () => {
              await refresh();
              if (useAppStore.getState().societyId) router.replace('/');
            }}
          />
          <Button
            title={store.societyId ? 'Back to my society' : 'Back to sign in'}
            variant="outline"
            onPress={() => router.replace(store.societyId ? '/' : '/sign-in')}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
