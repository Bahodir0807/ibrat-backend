import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const { method, url } = req;
    const requestId = req.requestId ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const now = Date.now();

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      this.logger.log(
        JSON.stringify({
          event: 'request.started',
          requestId,
          method,
          url,
          ip: req.ip,
          actor: req.user ? { id: req.user.userId, role: req.user.role } : undefined,
        }),
      );
    }

    return next
      .handle()
      .pipe(
        tap(() =>
          this.logger.log(
            JSON.stringify({
              event: 'request.completed',
              requestId,
              method,
              url,
              durationMs: Date.now() - now,
              actor: req.user ? { id: req.user.userId, role: req.user.role } : undefined,
            }),
          ),
        ),
      );
  }
}
