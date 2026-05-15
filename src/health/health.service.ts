import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppConfigService } from '../config/app-config.service';

type DatabaseStatus =
  | 'up'
  | 'down'
  | 'connecting'
  | 'disconnecting'
  | 'unknown';

type HealthPayload = {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  service: ReturnType<AppConfigService['getPublicMetadata']>;
  operational: ReturnType<AppConfigService['getOperationalMetadata']>;
  checks: {
    database: {
      status: DatabaseStatus;
      readyState: number;
    };
    self: {
      status: 'up' | 'down' | 'skipped';
      url?: string;
      statusCode?: number;
      latencyMs?: number;
      error?: string;
    };
  };
};

type VersionPayload = {
  name: string;
  version: string;
  environment: string;
  buildHash?: string;
  buildTime?: string;
  timestamp: string;
};

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly appConfig: AppConfigService,
  ) {}

  private getDatabaseStatus(): { status: DatabaseStatus; readyState: number } {
    const readyState = this.connection.readyState;
    const statusMap: Record<number, DatabaseStatus> = {
      0: 'down',
      1: 'up',
      2: 'connecting',
      3: 'disconnecting',
    };

    return {
      status: statusMap[readyState] ?? 'unknown',
      readyState,
    };
  }

  private getSelfPingBaseUrl(): string | undefined {
    return (process.env.SELF_PING_URL || process.env.DOMAIN)
      ?.trim()
      .replace(/\/+$/, '');
  }

  private async getSelfPingStatus(): Promise<HealthPayload['checks']['self']> {
    const baseUrl = this.getSelfPingBaseUrl();
    if (!baseUrl) {
      return { status: 'skipped' };
    }

    const url = `${baseUrl}/ping`;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      return {
        status: response.ok ? 'up' : 'down',
        url,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'down',
        url,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Self ping failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async buildPayload(): Promise<HealthPayload> {
    const database = this.getDatabaseStatus();
    const self = await this.getSelfPingStatus();
    const status =
      database.status === 'up' && self.status !== 'down' ? 'ok' : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      service: this.appConfig.getPublicMetadata(),
      operational: this.appConfig.getOperationalMetadata(),
      checks: {
        database,
        self,
      },
    };
  }

  getLiveness() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      service: this.appConfig.getPublicMetadata(),
      operational: this.appConfig.getOperationalMetadata(),
    };
  }

  getReadiness(): Promise<HealthPayload> {
    return this.buildPayload();
  }

  getHealth(): Promise<HealthPayload> {
    return this.buildPayload();
  }

  getVersion(): VersionPayload {
    return {
      ...this.appConfig.getPublicMetadata(),
      buildHash: process.env.BUILD_HASH,
      buildTime: process.env.BUILD_TIME,
      timestamp: new Date().toISOString(),
    };
  }
}
