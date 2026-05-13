import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppConfigService } from '../../config/app-config.service';
import {
  RATE_LIMIT_STORE,
  RateLimitStore,
} from '../rate-limit/rate-limit-store';

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly limitedPaths = new Set([
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/phone-request',
    '/phone-request/tg-request',
    '/phone-request/tg-check',
  ]);

  constructor(
    private readonly reflector: Reflector,
    private readonly appConfig: AppConfigService,
    @Inject(RATE_LIMIT_STORE) private readonly rateLimitStore: RateLimitStore,
  ) {}

  private isLimitedPath(path: string): boolean {
    const normalized = path.split('?')[0].replace(/\/+$/, '') || '/';
    return [...this.limitedPaths].some(
      (limitedPath) =>
        normalized === limitedPath || normalized.endsWith(limitedPath),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = String(request.route?.path ?? request.path ?? request.url);
    if (!this.isLimitedPath(path)) {
      return true;
    }

    const ttlMs = this.appConfig.rateLimit.windowMs;
    const max = this.appConfig.rateLimit.publicAuthMax;
    const actorKey = request.user?.userId
      ? `actor:${request.user.userId}`
      : undefined;
    const clientKey =
      actorKey ??
      `ip:${request.ip ?? request.socket?.remoteAddress ?? 'unknown'}`;
    const key = `public:${path}:${clientKey}`;
    let count: number;

    try {
      count = await this.rateLimitStore.increment(key, ttlMs);
    } catch (error) {
      throw new ServiceUnavailableException('Rate limiting is unavailable');
    }

    if (count > max) {
      throw new HttpException(
        'Too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
