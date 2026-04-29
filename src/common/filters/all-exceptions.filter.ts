import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    let error = 'InternalServerError';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      error = exception.name;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        if ('message' in res) {
          const normalizedMessage = res.message as string | string[];
          if (Array.isArray(normalizedMessage)) {
            details = normalizedMessage;
            message = 'Validation failed';
          } else {
            message = normalizedMessage;
          }
        } else if ('error' in res && typeof res.error === 'string') {
          error = res.error;
          message = error;
        } else {
          message = 'Request failed';
        }
      } else {
        message = 'Unknown error';
      }
    } else {
      message = 'Internal server error';
    }

    const requestId = request.requestId ?? 'n/a';
    const actor = request.user ? { id: request.user.userId, role: request.user.role } : undefined;
    response.setHeader('X-Request-Id', requestId);

    this.logger.error(
      JSON.stringify({
        event: 'request.failed',
        requestId,
        method: request.method,
        path: request.url,
        statusCode: status,
        error,
        message,
        actor,
      }),
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      error: {
        code: error,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    });
  }
}
