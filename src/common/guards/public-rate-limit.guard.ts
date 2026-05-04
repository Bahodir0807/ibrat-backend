import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppConfigService } from '../../config/app-config.service';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limitedPaths = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

  constructor(
    private readonly reflector: Reflector,
    private readonly appConfig: AppConfigService,
  ) {}

  private isLimitedPath(path: string): boolean {
    const normalized = path.split('?')[0].replace(/\/+$/, '') || '/';
    return [...this.limitedPaths].some(limitedPath => normalized === limitedPath || normalized.endsWith(limitedPath));
  }

  canActivate(context: ExecutionContext): boolean {
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

    const now = Date.now();
    const windowMs = this.appConfig.rateLimit.windowMs;
    const max = this.appConfig.rateLimit.publicAuthMax;
    const key = `${request.ip ?? request.socket?.remoteAddress ?? 'unknown'}:${path}`;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException('Too many requests, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
