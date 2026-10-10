import { describe, expect, it, vi } from 'vitest';
import { createOtpDelivery } from '../email.js';

const config = {
  RESEND_API_KEY: 're_testing_only',
  EMAIL_FROM: 'Portl <auth@example.com>',
};

describe('OTP email delivery', () => {
  it('submits the code to Resend over HTTPS and requires provider acceptance', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'test-email' }));
    await createOtpDelivery(config, transport)('resident@example.com', '123456');

    expect(transport).toHaveBeenCalledOnce();
    const [url, options] = transport.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(options).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer re_testing_only', 'Content-Type': 'application/json' },
      redirect: 'error',
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const email = JSON.parse(options?.body as string);
    expect(email.from).toBe(config.EMAIL_FROM);
    expect(email.to).toEqual(['resident@example.com']);
    expect(email.text).toContain('123456');
    expect(email.text).toContain('5 minutes');
  });

  it.each([401, 403, 429, 500])(
    'rejects provider failure (%i) without leaking its response',
    async (status) => {
      const privateMessage = 'resident@example.com re_testing_only 123456';
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ message: privateMessage }, { status }));
      const result = createOtpDelivery(config, transport)('resident@example.com', '123456');
      await expect(result).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_REJECTED', status });
      await expect(result).rejects.not.toThrow(/resident@example.com|re_testing_only|123456/);
      await expect(result).rejects.not.toHaveProperty('cause');
      expect(transport).toHaveBeenCalledOnce();
    },
  );

  it.each([
    new Error('transport error containing resident@example.com'),
    new DOMException('request expired', 'TimeoutError'),
  ])('fails safely on a transport error or timeout', async (error) => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(error);
    const result = createOtpDelivery(config, transport)('resident@example.com', '123456');
    await expect(result).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_UNAVAILABLE' });
    await expect(result).rejects.toThrow(
      'We could not send your sign-in code. Please try again shortly.',
    );
    await expect(result).rejects.not.toHaveProperty('cause');
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each([{}, { id: '' }, { id: 1 }])(
    'rejects an invalid acceptance response (%j)',
    async (body) => {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body));
      await expect(
        createOtpDelivery(config, transport)('resident@example.com', '123456'),
      ).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_INVALID_RESPONSE' });
    },
  );

  it('rejects a non-JSON provider response', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json'));
    await expect(
      createOtpDelivery(config, transport)('resident@example.com', '123456'),
    ).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_INVALID_RESPONSE' });
  });
});
