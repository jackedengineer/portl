import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { createTransport } from 'nodemailer';
import { schema, type Database } from '@portl/database';
import type { Config } from './config.js';

export function createAuth(
  db: Database,
  config: Config,
  deliverCode?: (email: string, otp: string) => Promise<void>,
) {
  const mail = createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    requireTLS: config.NODE_ENV === 'production' && config.SMTP_PORT !== 465,
    connectionTimeout: 10000,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
  });
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
          if (deliverCode) return deliverCode(email, otp);
          await mail.sendMail({
            from: config.EMAIL_FROM,
            to: email,
            subject: 'Your Portl sign-in code',
            text: `Your Portl code is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
          });
        },
      }),
    ],
  });
}
