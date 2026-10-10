import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { schema, type Database } from '@portl/database';
import type { Config } from './config.js';
import { createOtpDelivery, type OtpDelivery } from './email.js';

export function createAuth(db: Database, config: Config, deliverCode?: OtpDelivery) {
  const deliver = deliverCode ?? createOtpDelivery(config);
  return betterAuth({
    appName: 'Portl',
    baseURL: config.API_URL,
    secret: config.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    trustedOrigins: [config.WEB_ORIGIN, 'portl://'],
    advanced: {
      database: { generateId: () => randomUUID() },
      useSecureCookies: config.NODE_ENV === 'production',
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, window: 60, max: 20, storage: 'database' },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }) {
          await deliver(email, otp);
        },
      }),
    ],
  });
}
