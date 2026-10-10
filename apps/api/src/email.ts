import { z } from 'zod';
import type { Config } from './config.js';

export type OtpDelivery = (email: string, otp: string) => Promise<void>;

export class EmailDeliveryError extends Error {
  constructor(
    public readonly code:
      'EMAIL_PROVIDER_REJECTED' | 'EMAIL_PROVIDER_UNAVAILABLE' | 'EMAIL_PROVIDER_INVALID_RESPONSE',
    public readonly status?: number,
  ) {
    super('We could not send your sign-in code. Please try again shortly.');
    this.name = 'EmailDeliveryError';
  }
}

const acceptedEmail = z.object({ id: z.string().min(1) });

export function createOtpDelivery(
  config: Pick<Config, 'RESEND_API_KEY' | 'EMAIL_FROM'>,
  transport: typeof fetch = fetch,
): OtpDelivery {
  return async (email, otp) => {
    let response: Response;
    try {
      response = await transport('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.EMAIL_FROM,
          to: [email],
          subject: 'Your Portl sign-in code',
          text: `Your Portl code is ${otp}. It expires in 5 minutes. If you did not request this, you can ignore this email.`,
        }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
    } catch {
      throw new EmailDeliveryError('EMAIL_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok) throw new EmailDeliveryError('EMAIL_PROVIDER_REJECTED', response.status);

    try {
      acceptedEmail.parse(await response.json());
    } catch {
      throw new EmailDeliveryError('EMAIL_PROVIDER_INVALID_RESPONSE', response.status);
    }
  };
}
