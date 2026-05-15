import { HealthService } from './health.service';

function createService() {
  const connection = { readyState: 1 };
  const appConfig = {
    getPublicMetadata: jest.fn(() => ({
      name: 'panda',
      version: '0.0.1',
      environment: 'test',
    })),
    getOperationalMetadata: jest.fn(() => ({
      branchAware: true,
      tenantMode: 'single-database',
      tenantKeyHeader: 'x-tenant-id',
      branchKeyHeader: 'x-branch-id',
    })),
  };

  return new HealthService(connection as never, appConfig as never);
}

describe('HealthService self ping', () => {
  const originalSelfPingUrl = process.env.SELF_PING_URL;
  const originalSelfPingRequired = process.env.SELF_PING_REQUIRED;
  const originalDomain = process.env.DOMAIN;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.SELF_PING_URL = originalSelfPingUrl;
    process.env.SELF_PING_REQUIRED = originalSelfPingRequired;
    process.env.DOMAIN = originalDomain;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('skips self ping when no public URL is configured', async () => {
    delete process.env.SELF_PING_URL;
    delete process.env.DOMAIN;

    const health = await createService().getHealth();

    expect(health.status).toBe('ok');
    expect(health.checks.self).toEqual({ status: 'skipped' });
  });

  it('pings the configured public URL', async () => {
    process.env.SELF_PING_URL = 'https://backend.example.com/';
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
    })) as never;

    const health = await createService().getHealth();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://backend.example.com/ping',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(health.status).toBe('ok');
    expect(health.checks.self).toMatchObject({
      status: 'up',
      url: 'https://backend.example.com/ping',
      statusCode: 200,
    });
  });

  it('reports failed self ping without failing health by default', async () => {
    process.env.SELF_PING_URL = 'https://backend.example.com';
    delete process.env.SELF_PING_REQUIRED;
    global.fetch = jest.fn(async () => {
      throw new Error('fetch failed');
    }) as never;

    const health = await createService().getHealth();

    expect(health.status).toBe('ok');
    expect(health.checks.self).toMatchObject({
      status: 'down',
      url: 'https://backend.example.com/ping',
      error: 'fetch failed',
    });
  });

  it('fails health when self ping is required', async () => {
    process.env.SELF_PING_URL = 'https://backend.example.com';
    process.env.SELF_PING_REQUIRED = 'true';
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
    })) as never;

    const health = await createService().getHealth();

    expect(health.status).toBe('error');
    expect(health.checks.self).toMatchObject({
      status: 'down',
      statusCode: 502,
    });
  });
});
