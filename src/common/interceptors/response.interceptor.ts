import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginatedResult } from '../responses/paginated-result';

function isPaginatedResult(value: unknown): value is PaginatedResult<unknown> {
  return Boolean(
    value
      && typeof value === 'object'
      && 'items' in value
      && 'pagination' in value,
  );
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      map((data: unknown) => {
        const timestamp = new Date().toISOString();
        const requestId = request?.requestId ?? 'n/a';

        if (isPaginatedResult(data)) {
          return {
            success: true,
            data: data.items,
            meta: {
              timestamp,
              requestId,
              pagination: data.pagination,
            },
          };
        }

        return {
          success: true,
          data,
          meta: {
            timestamp,
            requestId,
          },
        };
      }),
    );
  }
}
