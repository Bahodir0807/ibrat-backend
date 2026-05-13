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
  function guard(max = 2, store = { increment: jest.fn(async () => 1) }) {
    return new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: max } } as any,
      store,
    );
  }

  it('limits public auth endpoints by ip and path', async () => {
    const store = {
      increment: jest
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3),
    };
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 2 } } as any,
      store as any,
    );

    await expect(guard.canActivate(context('/auth/login'))).resolves.toBe(true);
    await expect(guard.canActivate(context('/auth/login'))).resolves.toBe(true);
    await expect(
      guard.canActivate(context('/auth/login')),
    ).rejects.toBeInstanceOf(HttpException);
    expect(store.increment).toHaveBeenCalledWith(
      'public:/auth/login:ip:127.0.0.1',
      60_000,
    );
  });

  it('limits public auth endpoints behind a global prefix', async () => {
    const store = {
      increment: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
    };
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 1 } } as any,
      store as any,
    );

    await expect(guard.canActivate(context('/api/auth/login'))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(context('/api/auth/login')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('limits public phone request endpoints', async () => {
    const store = {
      increment: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2),
    };
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => true) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 1 } } as any,
      store as any,
    );

    await expect(
      guard.canActivate(context('/phone-request/tg-check')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context('/phone-request/tg-check')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('does not limit non-public handlers', async () => {
    const store = { increment: jest.fn() };
    const guard = new PublicRateLimitGuard(
      { getAllAndOverride: jest.fn(() => false) } as any,
      { rateLimit: { windowMs: 60_000, publicAuthMax: 0 } } as any,
      store,
    );

    await expect(guard.canActivate(context('/auth/login'))).resolves.toBe(true);
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('does not limit non-configured public paths', async () => {
    const store = { increment: jest.fn() };
    const limiter = guard(1, store);

    await expect(limiter.canActivate(context('/ping'))).resolves.toBe(true);
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('fails closed when the rate limit store is unavailable', async () => {
    const limiter = guard(1, {
      increment: jest.fn(async () => {
        throw new Error('redis down');
      }),
    });

    await expect(limiter.canActivate(context('/auth/login'))).rejects.toThrow(
      'Rate limiting is unavailable',
    );
  });
});
