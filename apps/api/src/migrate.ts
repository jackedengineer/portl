import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '@portl/database';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const { db, pool } = createDatabase(process.env.DATABASE_URL);
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../migrations/', import.meta.url)),
  });
} finally {
  await pool.end();
}
