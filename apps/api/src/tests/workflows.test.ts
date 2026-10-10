import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { schema as s, type Database } from '@portl/database';
import { createAuth } from '../auth.js';
import { runMaintenance } from '../maintenance.js';
import { createApp } from '../app.js';
const pg = new PGlite();
const db = drizzle(pg, { schema: s }) as unknown as Database;
const ids = Object.fromEntries(
  [
    'society',
    'other',
    'tower',
    'otherTower',
    'flat',
    'secondFlat',
    'otherFlat',
    'resident',
    'neighbour',
    'guard',
    'admin',
    'outsider',
    'residentMember',
    'neighbourMember',
    'guardMember',
    'adminMember',
    'outsiderMember',
    'amenity',
    'slot',
  ].map((key) => [key, randomUUID()]),
) as Record<string, string>;
const users = ['resident', 'neighbour', 'guard', 'admin', 'outsider'];
const app = createApp({
  db,
  webOrigin: 'http://localhost:8081',
  resolveIdentity: async (req) => {
    const actor = req.get('X-Test-User');
    return actor && users.includes(actor)
      ? { id: ids[actor]!, name: actor, email: `${actor}@example.com`, emailVerified: true }
      : null;
  },
  onError: (e) => {
    throw e;
  },
});
const api = (actor: string, role = actor === 'neighbour' ? 'resident' : actor) => ({
  get: (path: string) =>
    request(app)
      .get(`/v1/societies/${ids.society}${path}`)
      .set('X-Test-User', actor)
      .set('X-Portl-Role', role),
  post: (path: string, body = {}) =>
    request(app)
      .post(`/v1/societies/${ids.society}${path}`)
      .set('X-Test-User', actor)
      .set('X-Portl-Role', role)
      .send(body),
});
beforeAll(async () => {
  const folder = new URL('../../../../packages/database/migrations/', import.meta.url);
  for (const file of (await readdir(folder)).filter((f) => f.endsWith('.sql')).sort())
    await pg.exec(await readFile(new URL(file, folder), 'utf8'));
  await db.insert(s.user).values(
    users.map((name) => ({
      id: ids[name]!,
      name,
      email: `${name}@example.com`,
      emailVerified: true,
    })),
  );
  await db.insert(s.societies).values([
    { id: ids.society, name: 'Society One', code: 'ONE123', city: 'Bengaluru' },
    { id: ids.other, name: 'Other Society', code: 'OTHER123', city: 'Mumbai' },
  ]);
  await db.insert(s.towers).values([
    { id: ids.tower, societyId: ids.society!, name: 'Tower A' },
    { id: ids.otherTower, societyId: ids.other!, name: 'Tower B' },
  ]);
  await db.insert(s.flats).values([
    { id: ids.flat, societyId: ids.society!, towerId: ids.tower!, number: '101' },
    { id: ids.secondFlat, societyId: ids.society!, towerId: ids.tower!, number: '102' },
    { id: ids.otherFlat, societyId: ids.other!, towerId: ids.otherTower!, number: '201' },
  ]);
  await db.insert(s.memberships).values(
    users.map((actor) => ({
      id: ids[`${actor}Member`],
      societyId: actor === 'outsider' ? ids.other! : ids.society!,
      userId: ids[actor]!,
      roles: [
        actor === 'neighbour' || actor === 'outsider'
          ? ('resident' as const)
          : (actor as 'resident' | 'guard' | 'admin'),
      ],
    })),
  );
  await db.insert(s.occupancies).values([
    { societyId: ids.society!, flatId: ids.flat!, membershipId: ids.residentMember! },
    { societyId: ids.society!, flatId: ids.secondFlat!, membershipId: ids.neighbourMember! },
  ]);
  await db.insert(s.amenities).values({
    id: ids.amenity,
    societyId: ids.society!,
    name: 'Court',
    kind: 'court',
    description: 'A test court',
    capacity: 1,
  });
  await db.insert(s.amenitySlots).values({
    id: ids.slot,
    societyId: ids.society!,
    amenityId: ids.amenity!,
    startsAt: new Date(Date.now() + 3600000),
    endsAt: new Date(Date.now() + 7200000),
    capacity: 1,
  });
});
afterAll(async () => {
  await pg.close();
});
afterEach(() => vi.restoreAllMocks());
describe('tenant isolation and role authority', () => {
  it('requires authenticated identity and active assigned role', async () => {
    expect((await request(app).get('/v1/me')).status).toBe(401);
    expect((await api('outsider', 'resident').get('/overview')).status).toBe(403);
    expect((await api('resident', 'admin').get('/overview')).status).toBe(403);
    expect(
      (
        await api('guard').post('/notices', {
          title: 'Hello',
          body: 'Some notice',
          category: 'event',
        })
      ).status,
    ).toBe(403);
  });
  it('rejects a cross-society flat even when submitted by a valid guard', async () => {
    expect(
      (
        await api('guard').post('/visits', {
          requestId: randomUUID(),
          name: 'Visitor',
          kind: 'guest',
          flatId: ids.otherFlat,
        })
      ).status,
    ).toBe(404);
  });
});
describe('gate workflows', () => {
  it('protects household decisions and makes entry/exit conditional on current state', async () => {
    const input = {
      requestId: randomUUID(),
      name: 'Delivery Person',
      kind: 'delivery',
      company: 'Demo',
      flatId: ids.flat,
    };
    const created = await api('guard').post('/visits', input);
    expect(created.status).toBe(201);
    const visitId = created.body.id;
    expect((await api('guard').post('/visits', input)).body.id).toBe(visitId);
    expect(
      (await api('guard').post(`/visits/${visitId}/actions`, { action: 'enter' })).status,
    ).toBe(409);
    expect(
      (await api('neighbour').post(`/visits/${visitId}/actions`, { action: 'approve' })).status,
    ).toBe(403);
    expect(
      (await api('resident').post(`/visits/${visitId}/actions`, { action: 'approve' })).status,
    ).toBe(200);
    expect(
      (await api('resident').post(`/visits/${visitId}/actions`, { action: 'reject' })).status,
    ).toBe(409);
    expect(
      (await api('resident').post(`/visits/${visitId}/actions`, { action: 'enter' })).status,
    ).toBe(403);
    expect(
      (await api('guard').post(`/visits/${visitId}/actions`, { action: 'enter' })).status,
    ).toBe(200);
    expect((await api('guard').post(`/visits/${visitId}/actions`, { action: 'exit' })).status).toBe(
      200,
    );
    expect((await api('guard').post(`/visits/${visitId}/actions`, { action: 'exit' })).status).toBe(
      409,
    );
    const home = await api('neighbour').get('/overview');
    expect(home.body.visits.find((v: { id: string }) => v.id === visitId)).toBeUndefined();
    const outbox = await db.select().from(s.outbox);
    expect(outbox.length).toBeGreaterThan(0);
  });
  it('rejects expired requests and keeps passes single-use', async () => {
    const expired = randomUUID();
    await db.insert(s.visits).values({
      id: expired,
      societyId: ids.society!,
      flatId: ids.flat!,
      name: 'Expired visitor',
      kind: 'guest',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(
      (await api('resident').post(`/visits/${expired}/actions`, { action: 'approve' })).status,
    ).toBe(409);
    const pass = await api('resident').post('/passes', {
      name: 'Invited Guest',
      flatId: ids.flat,
      validFrom: new Date(Date.now() - 1000).toISOString(),
      validUntil: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(pass.status).toBe(201);
    expect(pass.body.token).toBeTypeOf('string');
    expect((await api('guard').post('/passes/redeem', { token: pass.body.token })).status).toBe(
      200,
    );
    expect((await api('guard').post('/passes/redeem', { token: pass.body.token })).status).toBe(
      409,
    );
  });
});
describe('booking capacity and onboarding', () => {
  it('never sells more than the slot capacity and returns a repeated booking', async () => {
    const one = await api('resident').post('/bookings', { slotId: ids.slot });
    expect(one.status).toBe(201);
    const repeated = await api('resident').post('/bookings', { slotId: ids.slot });
    expect(repeated.body.id).toBe(one.body.id);
    expect((await api('neighbour').post('/bookings', { slotId: ids.slot })).status).toBe(409);
    expect((await api('neighbour').post(`/bookings/${one.body.id}/cancel`)).status).toBe(403);
    expect((await api('resident').post(`/bookings/${one.body.id}/cancel`)).status).toBe(200);
    expect((await api('neighbour').post('/bookings', { slotId: ids.slot })).status).toBe(201);
    const [slot] = await db.select().from(s.amenitySlots).where(eq(s.amenitySlots.id, ids.slot!));
    expect(slot?.reserved).toBe(1);
  });
  it('binds invitations to a verified email and prevents repeated acceptance', async () => {
    const invitation = await api('admin').post('/invitations', {
      email: 'outsider@example.com',
      flatId: ids.flat,
    });
    expect(invitation.status).toBe(201);
    const accept = (actor: string) =>
      request(app)
        .post('/v1/invitations/accept')
        .set('X-Test-User', actor)
        .send({ token: invitation.body.token });
    expect((await accept('resident')).status).toBe(400);
    expect((await accept('outsider')).status).toBe(200);
    expect((await accept('outsider')).status).toBe(400);
  });
  it('protects the last administrator from suspension', async () => {
    const response = await request(app)
      .patch(`/v1/societies/${ids.society}/members/${ids.adminMember}`)
      .set('X-Test-User', 'admin')
      .set('X-Portl-Role', 'admin')
      .send({ status: 'suspended' });
    expect(response.status).toBe(409);
  });
});

describe('OTP sessions and lifecycle controls', () => {
  it('verifies a delivered OTP, creates a real session, and rejects replay', async () => {
    const delivered: string[] = [];
    const sendEmail = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      expect(url).toBe('https://api.resend.com/emails');
      const message = JSON.parse(options?.body as string);
      expect(message.to).toEqual(['new-resident@example.com']);
      expect(message.from).toBe('test@example.com');
      const code = message.text.match(/Your Portl code is (\d{6})\./)?.[1];
      expect(code).toBeDefined();
      delivered.push(code);
      return Response.json({ id: 'test-email' });
    });
    const auth = createAuth(db, {
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: 'postgresql://test',
      BETTER_AUTH_SECRET: 'testing-only-secret-with-at-least-32-characters',
      API_URL: 'http://localhost:4000',
      WEB_ORIGIN: 'http://localhost:8081',
      RESEND_API_KEY: 're_testing_only',
      EMAIL_FROM: 'test@example.com',
    });
    const send = await auth.handler(
      new Request('http://localhost:4000/api/auth/email-otp/send-verification-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
        body: JSON.stringify({ email: 'new-resident@example.com', type: 'sign-in' }),
      }),
    );
    expect(send.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(delivered[0]).toMatch(/^\d{6}$/);
    const stored = await db.select().from(s.verification);
    expect(stored.every((v) => !v.value.includes(delivered[0]!))).toBe(true);
    const signIn = () =>
      auth.handler(
        new Request('http://localhost:4000/api/auth/sign-in/email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
          body: JSON.stringify({ email: 'new-resident@example.com', otp: delivered[0] }),
        }),
      );
    const verified = await signIn();
    expect(verified.status).toBe(200);
    const cookie = verified.headers.get('set-cookie');
    expect(cookie).toContain('HttpOnly');
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookie! }) });
    expect(session?.user.emailVerified).toBe(true);
    expect((await signIn()).status).toBe(400);
  });
  it('rejects cross-origin mutations and deletion of the last administrator', async () => {
    expect(
      (
        await request(app)
          .post('/v1/me/deletion')
          .set('X-Test-User', 'resident')
          .set('Origin', 'https://unrelated.example')
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await request(app).post('/v1/me/deletion').set('X-Test-User', 'admin').send({})).status,
    ).toBe(409);
  });
  it('deletes a requested account and releases future booking capacity', async () => {
    const result = await request(app)
      .post('/v1/me/deletion')
      .set('X-Test-User', 'neighbour')
      .send({});
    expect(result.status).toBe(202);
    expect((await api('neighbour').get('/overview')).status).toBe(403);
    await runMaintenance(db);
    expect(await db.select().from(s.user).where(eq(s.user.id, ids.neighbour!))).toHaveLength(0);
    const [slot] = await db.select().from(s.amenitySlots).where(eq(s.amenitySlots.id, ids.slot!));
    expect(slot?.reserved).toBe(0);
  });
});
