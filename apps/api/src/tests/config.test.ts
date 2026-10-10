import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../config.js';

function configure(overrides: Record<string, string | undefined> = {}) {
  const values = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://test',
    BETTER_AUTH_SECRET: 'testing-only-secret-with-at-least-32-characters',
    API_URL: 'https://api.example.com',
    WEB_ORIGIN: 'https://example.com',
    RESEND_API_KEY: 're_testing_only',
    EMAIL_FROM: 'Portl <auth@example.com>',
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

afterEach(() => vi.unstubAllEnvs());

describe('Resend configuration', () => {
  it('starts with a server-side Resend key and no SMTP configuration', () => {
    configure();
    expect(readConfig()).toMatchObject({
      RESEND_API_KEY: 're_testing_only',
      EMAIL_FROM: 'Portl <auth@example.com>',
    });
  });

  it.each([undefined, '', '   '])('rejects a missing or empty Resend key (%s)', (value) => {
    configure({ RESEND_API_KEY: value });
    expect(() => readConfig()).toThrow('RESEND_API_KEY');
  });

  it('does not expose environment values in a validation error', () => {
    configure({ RESEND_API_KEY: 're_testing_only_private', EMAIL_FROM: '' });
    expect(() => readConfig()).toThrow('EMAIL_FROM');
    expect(() => readConfig()).not.toThrow('re_testing_only_private');
  });

  it('continues to require HTTPS for the production API', () => {
    configure({ API_URL: 'http://api.example.com' });
    expect(() => readConfig()).toThrow('Production API_URL must use HTTPS.');
  });
});
