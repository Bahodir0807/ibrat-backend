import { HttpException } from '@nestjs/common';
import { PublicRateLimitGuard } from './public-rate-limit.guard';

function context(path: string, ip = '127.0.0.1') {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        route: { path },
        path,
        ip,
      }),
    }),
  } as any;
}

describe('PublicRateLimitGuard', () => {
  it('limits public auth endpoints by ip and path', () => {
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 2 } } as any,
    );

    expect(guard.canActivate(context('/auth/login'))).toBe(true);
    expect(guard.canActivate(context('/auth/login'))).toBe(true);
    expect(() => guard.canActivate(context('/auth/login'))).toThrow(HttpException);
  });

  it('limits public auth endpoints behind a global prefix', () => {
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 1 } } as any,
    );

    expect(guard.canActivate(context('/api/auth/login'))).toBe(true);
    expect(() => guard.canActivate(context('/api/auth/login'))).toThrow(HttpException);
  });

  it('limits public phone request endpoints', () => {
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 1 } } as any,
    );

    expect(guard.canActivate(context('/phone-request/tg-check'))).toBe(true);
    expect(() => guard.canActivate(context('/phone-request/tg-check'))).toThrow(HttpException);
  });

  it('does not limit non-public handlers', () => {
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => false) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 0 } } as any,
    );

    expect(guard.canActivate(context('/auth/login'))).toBe(true);
  });
});
