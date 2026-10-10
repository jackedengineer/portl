import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import pino from 'pino';
import { z } from 'zod';
import { createDatabase, schema as s } from '@portl/database';
import { runMaintenance } from './maintenance.js';
const config = z
  .object({ DATABASE_URL: z.string().min(1), EXPO_ACCESS_TOKEN: z.string().optional() })
  .parse(process.env);
const { db, pool } = createDatabase(config.DATABASE_URL),
  log = pino();
let stopping = false,
  maintenanceAt = 0;
async function expo(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${config.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`PUSH_HTTP_${response.status}`);
  const result = (await response.json()) as { data?: unknown; errors?: unknown[] };
  if (!result.data || result.errors?.length) throw new Error('PUSH_RESPONSE_ERROR');
  return result.data;
}
const receipt = z.object({
  status: z.enum(['ok', 'error']),
  id: z.string().optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});
async function deliver() {
  const item = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(s.outbox)
      .where(
        and(
          isNull(s.outbox.completedAt),
          lte(s.outbox.availableAt, new Date()),
          or(isNull(s.outbox.lockedUntil), lte(s.outbox.lockedUntil, new Date())),
        ),
      )
      .orderBy(s.outbox.availableAt)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!row) return null;
    await tx
      .update(s.outbox)
      .set({ lockedUntil: new Date(Date.now() + 120000), attempts: row.attempts + 1 })
      .where(eq(s.outbox.id, row.id));
    return row;
  });
  if (!item) return false;
  try {
    if (item.tickets?.length) {
      const result = z
        .record(z.string(), receipt)
        .parse(await expo('getReceipts', { ids: item.tickets.map((t) => t.id) }));
      let waiting = false;
      for (const ticket of item.tickets) {
        const status = result[ticket.id];
        if (!status) {
          waiting = true;
          continue;
        }
        if (status.details?.error === 'DeviceNotRegistered')
          await db.delete(s.pushDevices).where(eq(s.pushDevices.token, ticket.token));
        if (status.status === 'error')
          log.warn(
            { outboxId: item.id, code: status.details?.error },
            'Push receipt reported an error',
          );
      }
      if (waiting && item.submittedAt && Date.now() - item.submittedAt.getTime() < 86400000) {
        await db
          .update(s.outbox)
          .set({ lockedUntil: null, availableAt: new Date(Date.now() + 15 * 60000) })
          .where(eq(s.outbox.id, item.id));
        return true;
      }
    } else {
      const [notification] = await db
        .select()
        .from(s.notifications)
        .where(eq(s.notifications.id, item.notificationId));
      if (!notification) return true;
      const [member] = await db
        .select()
        .from(s.memberships)
        .where(
          and(
            eq(s.memberships.userId, notification.userId),
            eq(s.memberships.societyId, notification.societyId),
            eq(s.memberships.status, 'active'),
          ),
        );
      const devices = member
        ? await db
            .select()
            .from(s.pushDevices)
            .where(eq(s.pushDevices.userId, notification.userId))
            .limit(100)
        : [];
      if (devices.length) {
        const tickets = z.array(receipt).parse(
          await expo(
            'send',
            devices.map((device) => ({
              to: device.token,
              title: 'An update from your community',
              body: 'Open Portl to view your latest update.',
              sound: 'default',
              channelId: 'gate',
              data: { notificationId: notification.id, societyId: notification.societyId },
              ttl: 900,
            })),
          ),
        );
        if (tickets.length !== devices.length) throw new Error('PUSH_TICKET_COUNT');
        const accepted: { id: string; token: string }[] = [];
        for (const [index, ticket] of tickets.entries()) {
          const token = devices[index]!.token;
          if (ticket.status === 'ok' && ticket.id) accepted.push({ id: ticket.id, token });
          else if (ticket.details?.error === 'DeviceNotRegistered')
            await db.delete(s.pushDevices).where(eq(s.pushDevices.token, token));
          else log.warn({ outboxId: item.id, code: ticket.details?.error }, 'Push ticket rejected');
        }
        if (accepted.length) {
          await db
            .update(s.outbox)
            .set({
              tickets: accepted,
              submittedAt: new Date(),
              lockedUntil: null,
              availableAt: new Date(Date.now() + 15 * 60000),
            })
            .where(eq(s.outbox.id, item.id));
          return true;
        }
      }
    }
    await db
      .update(s.outbox)
      .set({ completedAt: new Date(), lockedUntil: null, lastError: null })
      .where(eq(s.outbox.id, item.id));
  } catch {
    // Never log payloads, recipient addresses or push tokens.
    log.warn({ outboxId: item.id, attempt: item.attempts + 1 }, 'Push delivery failed');
    await db
      .update(s.outbox)
      .set({
        lockedUntil: null,
        lastError: 'Delivery failed',
        availableAt: new Date(
          Date.now() + Math.min(3600000, 10000 * 2 ** Math.min(item.attempts, 9)),
        ),
        ...(item.attempts >= 9 ? { completedAt: new Date() } : {}),
      })
      .where(eq(s.outbox.id, item.id));
  }
  return true;
}
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
async function main() {
  while (!stopping) {
    try {
      if (Date.now() >= maintenanceAt) {
        const result = await runMaintenance(db);
        log.info(result, 'Maintenance completed');
        maintenanceAt = Date.now() + 3600000;
      }
      if (!(await deliver())) await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch {
      log.error('Worker cycle failed');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await pool.end();
}
void main();
