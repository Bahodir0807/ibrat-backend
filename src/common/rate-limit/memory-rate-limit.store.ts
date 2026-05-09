import { Injectable } from '@nestjs/common';
import { RateLimitStore } from './rate-limit-store';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  async increment(key: string, ttlMs: number): Promise<number> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + ttlMs });
      return 1;
    }

    bucket.count += 1;
    return bucket.count;
  }
}
