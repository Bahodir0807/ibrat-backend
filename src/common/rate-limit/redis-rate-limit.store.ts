import { Injectable } from '@nestjs/common';
import { RateLimitStore } from './rate-limit-store';
import { RedisRateLimitClient } from './redis-rate-limit.client';

@Injectable()
export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisRateLimitClient) {}

  async assertReady(): Promise<void> {
    await this.client.ping();
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    return this.client.incrementWithExpiry(key, ttlMs);
  }
}
