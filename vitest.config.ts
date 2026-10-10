import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: 'forks',
    maxWorkers: 1,
  },
});
