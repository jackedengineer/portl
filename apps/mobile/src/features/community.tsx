import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, Megaphone, Phone, Plus, Pencil, Trash2 } from 'lucide-react-native';
import type { Notice, Staff } from '@portl/contracts';
import { useOverview } from '../lib/api';
import { useAppStore, useToast } from '../lib/state';
import { day, initials } from '../lib/format';
import { colors as c } from '../design/theme';
import {
  Button,
  Card,
  Choices,
  Empty,
  IconButton,
  PageTitle,
  Row,
  Screen,
  SearchInput,
  Sheet,
  Tag,
  Txt,
} from '../components/ui';
import { ActionForm, useAction, type FormKind } from './forms';
export default function CommunityScreen() {
  const params = useLocalSearchParams<{ tab?: string }>(),
    [tab, setTab] = useState(params.tab ?? 'notices'),
    [search, setSearch] = useState(''),
    [notice, setNotice] = useState<Notice | null>(null),
    [form, setForm] = useState<FormKind | null>(null),
    [record, setRecord] = useState<Notice | Staff | undefined>(),
    { data } = useOverview(),
    { role, mode } = useAppStore(),
    { run, pending } = useAction();
  if (!data) return null;
  const staff = data.staff.filter((s) =>
    `${s.name} ${s.service}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Screen>
        <PageTitle
          eyebrow="Better, together"
          title="Your community corner."
          subtitle="The updates and people that keep your home humming."
        />
        <Row style={{ justifyContent: 'space-between' }}>
          <Choices
            options={[
              { value: 'notices', label: 'Notice board' },
              { value: 'directory', label: 'Directory' },
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
                setForm(tab === 'notices' ? 'notice' : 'staff');
              }}
            />
          )}
        </Row>
        {tab === 'notices' ? (
          <View style={{ gap: 16 }}>
            {data.notices.map((n) => (
              <Pressable accessibilityRole="button" key={n.id} onPress={() => setNotice(n)}>
                <Card style={{ padding: 23 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Tag
                      tone={
                        n.category === 'maintenance'
                          ? 'peach'
                          : n.category === 'event'
                            ? 'sage'
                            : 'blue'
                      }
                    >
                      {n.category.toUpperCase()}
                    </Tag>
                    <Txt size={11} color={c.muted}>
                      {day(n.publishedAt)}
                    </Txt>
                  </Row>
                  <Txt size={21} weight="semibold" style={{ marginTop: 18, letterSpacing: -0.6 }}>
                    {n.title}
                  </Txt>
                  <Txt numberOfLines={3} size={13} color={c.muted} style={{ marginTop: 9 }}>
                    {n.body}
                  </Txt>
                  <Row style={{ marginTop: 18, justifyContent: 'space-between' }}>
                    <Txt size={10} color={c.muted}>
                      {n.towerId
                        ? data.towers.find((t) => t.id === n.towerId)?.name
                        : 'All residents'}{' '}
                      · Society office
                    </Txt>
                    <ArrowUpRight size={18} color={c.forest} />
                  </Row>
                </Card>
              </Pressable>
            ))}
            {!data.notices.length && (
              <Empty
                icon={Megaphone}
                title="Nothing to announce, yet"
                description="Updates from your society office will appear here."
              />
            )}
          </View>
        ) : (
          <>
            <SearchInput
              value={search}
              onChangeText={setSearch}
              placeholder="Find a person or service"
            />
            <View style={{ gap: 12 }}>
              {staff.map((s) => (
                <Card key={s.id}>
                  <Row>
                    <View
                      style={{
                        width: 47,
                        height: 47,
                        borderRadius: 17,
                        backgroundColor: s.category === 'staff' ? c.sage : c.peach,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt weight="semibold" color={c.forest}>
                        {initials(s.name)}
                      </Txt>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt weight="semibold">{s.name}</Txt>
                      <Txt size={12} color={c.muted}>
                        {s.service}
                      </Txt>
                    </View>
                    {role === 'admin' && (
                      <IconButton
                        icon={Pencil}
                        label={`Edit ${s.name}`}
                        onPress={() => {
                          setRecord(s);
                          setForm('staff');
                        }}
                      />
                    )}
                    <IconButton
                      icon={Phone}
                      label={`Call ${s.name}`}
                      onPress={() => {
                        if (mode === 'demo')
                          useToast
                            .getState()
                            .show(
                              'Demo contacts are fictional. Calling is available for real society contacts.',
                            );
                        else
                          void Linking.openURL(`tel:${s.phone.replace(/ /g, '')}`).catch(() =>
                            useToast.getState().show('Could not open the phone app.', 'error'),
                          );
                      }}
                    />
                  </Row>
                  <Row style={{ marginTop: 15, justifyContent: 'space-between' }}>
                    <Txt size={11} color={c.muted}>
                      {s.hours}
                    </Txt>
                    <Tag tone="muted">
                      {s.category === 'staff' ? 'Society staff' : 'Service provider'}
                    </Tag>
                  </Row>
                  {role === 'admin' && (
                    <Button
                      title="Remove listing"
                      compact
                      variant="outline"
                      loading={pending}
                      style={{ marginTop: 12 }}
                      onPress={() =>
                        void run({ type: 'staff.delete', id: s.id }, 'Directory listing removed.')
                      }
                    />
                  )}
                </Card>
              ))}
              {!staff.length && (
                <Empty title="No matching contacts" description="Try another name or service." />
              )}
            </View>
          </>
        )}
      </Screen>
      <Sheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ''}
        subtitle={notice ? `${day(notice.publishedAt)} · Society office` : ''}
      >
        {notice && (
          <>
            <Tag>{notice.category.toUpperCase()}</Tag>
            <Txt size={15} style={{ lineHeight: 26 }}>
              {notice.body}
            </Txt>
            {role === 'admin' && (
              <Button
                title="Edit notice"
                variant="secondary"
                icon={Pencil}
                onPress={() => {
                  setRecord(notice);
                  setNotice(null);
                  setForm('notice');
                }}
              />
            )}
            {role === 'admin' && (
              <Button
                title="Delete notice"
                variant="danger"
                icon={Trash2}
                loading={pending}
                onPress={async () => {
                  const result = await run(
                    { type: 'notice.delete', id: notice.id },
                    'Notice removed.',
                  );
                  if (result) setNotice(null);
                }}
              />
            )}
          </>
        )}
      </Sheet>
      {form && <ActionForm kind={form} data={data} record={record} onClose={() => setForm(null)} />}
    </>
  );
}
