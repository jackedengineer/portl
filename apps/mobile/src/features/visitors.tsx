import { useNow } from '../lib/clock';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Plus, ScanLine, Ticket } from 'lucide-react-native';
import { useOverview } from '../lib/api';
import { useAppStore } from '../lib/state';
import { day, time } from '../lib/format';
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
  Tag,
  Txt,
} from '../components/ui';
import { ActionForm, useAction, type FormKind } from './forms';
import { VisitCard } from './visit-card';
export default function VisitorsScreen() {
  const params = useLocalSearchParams<{ filter?: string }>(),
    [filter, setFilter] = useState(params.filter ?? 'all'),
    [search, setSearch] = useState(''),
    [form, setForm] = useState<FormKind | null>(null),
    { data, refetch, isRefetching } = useOverview(),
    { role } = useAppStore(),
    { run, pending } = useAction();
  const now = useNow();
  if (!data) return null;
  const visits = data.visits.filter(
    (v) =>
      `${v.name} ${v.company} ${v.flatLabel}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'waiting' && ['requested', 'approved'].includes(v.status)) ||
        (filter === 'inside' && v.status === 'entered') ||
        (filter === 'history' && ['exited', 'rejected', 'expired', 'revoked'].includes(v.status))),
  );
  return (
    <>
      <Screen refreshing={isRefetching} onRefresh={() => void refetch()}>
        <PageTitle
          eyebrow={role === 'guard' ? 'Gate operations' : 'A warm welcome'}
          title={role === 'guard' ? 'Your gate log' : 'Visitors & guests'}
          subtitle={
            role === 'resident'
              ? 'Know who’s coming. Welcome them with a tap.'
              : 'Every arrival and departure, in one place.'
          }
        />
        {role !== 'admin' && (
          <Row>
            <Button
              style={{ flex: 1 }}
              title={role === 'guard' ? 'Register visitor' : 'Invite a guest'}
              icon={Plus}
              onPress={() => setForm(role === 'guard' ? 'visitor' : 'pass')}
            />
            {role === 'guard' && (
              <Button
                title="Verify pass"
                icon={ScanLine}
                variant="secondary"
                onPress={() => setForm('verify')}
              />
            )}
          </Row>
        )}
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, company or apartment"
        />
        <Choices
          options={[
            { value: 'all', label: 'All visits' },
            { value: 'waiting', label: 'At the gate' },
            { value: 'inside', label: 'Inside' },
            { value: 'history', label: 'History' },
            ...(role === 'resident' ? [{ value: 'passes', label: 'Guest passes' }] : []),
          ]}
          value={filter}
          onChange={setFilter}
        />
        <View style={{ gap: 14 }}>
          {filter === 'passes' ? (
            data.passes.length ? (
              data.passes.map((p) => (
                <Card key={p.id}>
                  <Row>
                    <Ticket size={23} color={c.forest} />
                    <View style={{ flex: 1 }}>
                      <Txt weight="semibold">{p.name}</Txt>
                      <Txt size={11} color={c.muted}>
                        {day(p.validFrom)} · {time(p.validFrom)} – {time(p.validUntil)}
                      </Txt>
                    </View>
                    <Tag>
                      {p.status === 'active' && Date.parse(p.validUntil) < now
                        ? 'Expired'
                        : p.status}
                    </Tag>
                  </Row>
                  <Txt size={12} color={c.muted} style={{ marginTop: 12 }}>
                    {p.flatLabel} · Single use
                  </Txt>
                  {p.status === 'active' && Date.parse(p.validUntil) > now && (
                    <Button
                      title="Revoke guest pass"
                      compact
                      variant="outline"
                      loading={pending}
                      style={{ marginTop: 14 }}
                      onPress={() =>
                        void run({ type: 'pass.revoke', id: p.id }, 'Guest pass revoked.')
                      }
                    />
                  )}
                </Card>
              ))
            ) : (
              <Empty
                title="Make their arrival easy"
                description="Invite a guest to give them a private, single-use pass."
              />
            )
          ) : visits.length ? (
            visits.map((v) => <VisitCard key={v.id} visit={v} />)
          ) : (
            <Empty
              title="Nothing here just yet"
              description="Visits matching this view will appear here. Try another filter or search."
            />
          )}
        </View>
        <Txt size={11} color={c.muted}>
          Showing the latest 100 visits. Pull down to refresh.
        </Txt>
      </Screen>
      {form && <ActionForm kind={form} data={data} onClose={() => setForm(null)} />}
    </>
  );
}
