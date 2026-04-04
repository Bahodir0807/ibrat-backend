import { Injectable, Logger } from '@nestjs/common';

type AuditActor = {
  id?: string;
  role?: string;
};

type AuditTarget = {
  type: string;
  id?: string;
};

type AuditEntry = {
  action: string;
  actor?: AuditActor;
  target?: AuditTarget;
  status?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger('Audit');

  log(entry: AuditEntry) {
    this.logger.log(JSON.stringify(this.sanitize(entry)));
  }

  logFailure(entry: AuditEntry) {
    this.logger.warn(JSON.stringify(this.sanitize({ ...entry, status: 'failure' })));
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.sanitize(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(source)) {
      if (['password', 'token', 'accessToken', 'refreshToken'].includes(key)) {
        continue;
      }

      result[key] = this.sanitize(nestedValue);
    }

    return result;
  }
}
