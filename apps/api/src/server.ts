import { createServer } from 'node:http';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import { Server } from 'socket.io';
import pino from 'pino';
import { createDatabase } from '@portl/database';
import { readConfig } from './config.js';
import { createAuth } from './auth.js';
import { createApp } from './app.js';
import { getContext } from './context.js';
import { z } from 'zod';

const config = readConfig();
const log = pino({ redact: ['req.headers.cookie', 'req.headers.authorization', 'email', 'token'] });
const { db, pool } = createDatabase(config.DATABASE_URL);
const auth = createAuth(db, config);
let io: Server;
const app = createApp({
  db,
  webOrigin: config.WEB_ORIGIN,
  installAuth: (app) => {
    app.all('/api/auth/{*path}', toNodeHandler(auth));
  },
  resolveIdentity: async (req) =>
    (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))?.user ?? null,
  onError: (_error, requestId) => log.error({ requestId }, 'Request failed'),
  onChange: (societyId) => io?.to(societyId).emit('refresh'),
});
const server = createServer(app);
io = new Server(server, { cors: { origin: config.WEB_ORIGIN, credentials: true } });
io.use(async (socket, next) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(socket.request.headers) });
    if (!session?.user.emailVerified) throw new Error('Sign-in required.');
    const societyId = z.uuid().parse(socket.handshake.auth.societyId);
    await getContext(db, session.user, societyId, socket.handshake.auth.role);
    socket.data.societyId = societyId;
    next();
  } catch {
    next(new Error('Access denied.'));
  }
});
io.on('connection', (socket) => {
  void socket.join(socket.data.societyId);
});
server.listen(config.PORT, '0.0.0.0', () => log.info({ port: config.PORT }, 'Portl API ready'));
async function shutdown() {
  io.close();
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
