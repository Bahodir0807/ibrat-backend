import { MemoryRateLimitStore } from './memory-rate-limit.store';

describe('MemoryRateLimitStore', () => {
  it('increments until the ttl expires', async () => {
    const store = new MemoryRateLimitStore();

    await expect(store.increment('key', 60_000)).resolves.toBe(1);
    await expect(store.increment('key', 60_000)).resolves.toBe(2);
  });
});
