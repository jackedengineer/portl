import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts', 'src/bootstrap.ts', 'src/migrate.ts'],
  format: ['esm'],
  target: 'node22',
  external: ['pg'],
  clean: true,
  sourcemap: true,
  noExternal: [/^@portl\//],
});
