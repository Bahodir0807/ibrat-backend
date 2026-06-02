import { SmsService } from './sms.service';

function createService(overrides: Record<string, unknown> = {}) {
  const appConfig = {
    sms: {
      enabled: false,
      provider: 'mock',
      dryRun: true,
      maxDebtRemindersPerDay: 3,
      ...overrides,
    },
  };
  const provider = {
    sendSms: jest.fn(async () => ({
      success: true,
      providerMessageId: 'provider-id',
      rawResponse: { ok: true },
    })),
  };
  return {
    service: new SmsService(appConfig as never, provider as never),
    provider,
  };
}

describe('SmsService', () => {
  it('mock provider returns success when enabled', async () => {
    const { service, provider } = createService({
      enabled: true,
      dryRun: false,
    });

    const result = await service.sendSms('+998 90 123 45 67', 'hello');

    expect(result.status).toBe('sent');
    expect(result.providerMessageId).toBe('provider-id');
    expect(provider.sendSms).toHaveBeenCalledWith(
      '+998901234567',
      'hello',
      undefined,
    );
  });

  it('dry-run does not call provider', async () => {
    const { service, provider } = createService({
      enabled: true,
      dryRun: true,
    });

    const result = await service.sendSms('+99890', 'hello');

    expect(result.status).toBe('dry_run');
    expect(provider.sendSms).not.toHaveBeenCalled();
  });

  it('disabled SMS does not send real SMS', async () => {
    const { service, provider } = createService({
      enabled: false,
      dryRun: false,
    });

    const result = await service.sendSms('+99890', 'hello');

    expect(result.status).toBe('skipped');
    expect(provider.sendSms).not.toHaveBeenCalled();
  });

  it('missing phone returns skipped', async () => {
    const { service, provider } = createService();

    const result = await service.sendSms(undefined, 'hello');

    expect(result.status).toBe('skipped');
    expect(provider.sendSms).not.toHaveBeenCalled();
  });

  it('rejects unsupported provider configuration clearly', () => {
    expect(() => createService({ provider: 'real-provider' })).toThrow(
      'Unsupported SMS_PROVIDER=real-provider',
    );
  });
});
