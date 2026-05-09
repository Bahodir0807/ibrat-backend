import { RedisRateLimitStore } from './redis-rate-limit.store';

describe('RedisRateLimitStore', () => {
  it('pings Redis during readiness checks', async () => {
    const client = {
      ping: jest.fn(async () => undefined),
      incrementWithExpiry: jest.fn(),
    };
    const store = new RedisRateLimitStore(client);

    await store.assertReady();

    expect(client.ping).toHaveBeenCalledTimes(1);
  });

  it('increments with a Redis-side expiry', async () => {
    const client = {
      ping: jest.fn(),
      incrementWithExpiry: jest.fn(async () => 2),
    };
    const store = new RedisRateLimitStore(client);

    await expect(store.increment('rate-limit:auth:127.0.0.1', 60_000)).resolves.toBe(2);
    expect(client.incrementWithExpiry).toHaveBeenCalledWith(
      'rate-limit:auth:127.0.0.1',
      60_000,
    );
  });
});
