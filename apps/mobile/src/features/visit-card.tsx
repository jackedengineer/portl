import { View } from 'react-native';
import {
  Package,
  CarFront,
  UserRound,
  Wrench,
  Check,
  X,
  ArrowRight,
  LogOut,
} from 'lucide-react-native';
import { kindLabels, type Visit } from '@portl/contracts';
import { Button, Card, Row, Tag, Txt } from '../components/ui';
import { colors as c } from '../design/theme';
import { relative, time } from '../lib/format';
import { useAppStore } from '../lib/state';
import { useAction } from './forms';
const icons = { guest: UserRound, delivery: Package, cab: CarFront, service: Wrench };
const labels = {
  requested: 'At the gate',
  approved: 'Approved',
  rejected: 'Denied',
  entered: 'Inside',
  exited: 'Completed',
  expired: 'Expired',
  revoked: 'Revoked',
};
export function VisitCard({ visit, prominent = false }: { visit: Visit; prominent?: boolean }) {
  const { role } = useAppStore(),
    { run, pending } = useAction(),
    Icon = icons[visit.kind];
  return (
    <Card
      style={{
        padding: prominent ? 22 : 18,
        borderColor: visit.status === 'requested' ? '#E5D1BE' : c.line,
      }}
    >
      <Row style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            width: 47,
            height: 47,
            borderRadius: 16,
            backgroundColor: visit.kind === 'delivery' ? c.peach : c.sage,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            color={visit.kind === 'delivery' ? c.coral : c.forest}
            size={23}
            strokeWidth={1.6}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Txt weight="semibold" size={16}>
            {visit.name}
          </Txt>
          <Txt color={c.muted} size={12} style={{ marginTop: 3 }}>
            {visit.company ? `${visit.company} · ` : ''}
            {kindLabels[visit.kind]}
          </Txt>
        </View>
        <Tag
          tone={
            visit.status === 'requested' ? 'peach' : visit.status === 'entered' ? 'blue' : 'sage'
          }
        >
          {labels[visit.status]}
        </Tag>
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <Txt size={11} color={c.muted}>
          {role === 'resident' ? 'Main gate' : visit.flatLabel} · {relative(visit.requestedAt)}
        </Txt>
        {visit.enteredAt && (
          <Txt size={11} color={c.muted}>
            {time(visit.enteredAt)}
            {visit.exitedAt ? ` – ${time(visit.exitedAt)}` : ''}
          </Txt>
        )}
      </Row>
      {visit.note ? (
        <Txt size={12} color={c.muted} style={{ marginTop: 10 }}>
          {visit.note}
        </Txt>
      ) : null}
      {role === 'resident' && visit.status === 'requested' && (
        <Row style={{ marginTop: 19, gap: 10 }}>
          <Button
            title="Deny"
            icon={X}
            variant="outline"
            loading={pending}
            style={{ flex: 1 }}
            onPress={() =>
              void run(
                { type: 'visit.action', id: visit.id, action: 'reject' },
                'The gate has been notified. Entry denied.',
              )
            }
          />
          <Button
            title="Approve entry"
            icon={Check}
            loading={pending}
            style={{ flex: 1.6 }}
            onPress={() =>
              void run(
                { type: 'visit.action', id: visit.id, action: 'approve' },
                'Approved. The gate has been notified.',
              )
            }
          />
        </Row>
      )}
      {role === 'guard' && ['approved', 'entered'].includes(visit.status) && (
        <Button
          title={visit.status === 'approved' ? 'Mark entry' : 'Mark exit'}
          icon={visit.status === 'approved' ? ArrowRight : LogOut}
          variant={visit.status === 'approved' ? 'primary' : 'secondary'}
          loading={pending}
          style={{ marginTop: 16 }}
          onPress={() =>
            void run(
              {
                type: 'visit.action',
                id: visit.id,
                action: visit.status === 'approved' ? 'enter' : 'exit',
              },
              visit.status === 'approved' ? 'Entry recorded.' : 'Exit recorded.',
            )
          }
        />
      )}
      {role === 'resident' && visit.status === 'approved' && (
        <Button
          compact
          title="Revoke approval"
          variant="outline"
          style={{ marginTop: 12 }}
          loading={pending}
          onPress={() =>
            void run({ type: 'visit.action', id: visit.id, action: 'revoke' }, 'Approval revoked.')
          }
        />
      )}
    </Card>
  );
}
