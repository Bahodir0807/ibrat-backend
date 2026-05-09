export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

export interface RateLimitStore {
  increment(key: string, ttlMs: number): Promise<number>;
}
