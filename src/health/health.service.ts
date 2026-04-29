import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppConfigService } from '../config/app-config.service';

type DatabaseStatus = 'up' | 'down' | 'connecting' | 'disconnecting' | 'unknown';

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
  };
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

  private buildPayload(): HealthPayload {
    const database = this.getDatabaseStatus();
    const status = database.status === 'up' ? 'ok' : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      service: this.appConfig.getPublicMetadata(),
      operational: this.appConfig.getOperationalMetadata(),
      checks: {
        database,
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

  getReadiness(): HealthPayload {
    return this.buildPayload();
  }

  getHealth(): HealthPayload {
    return this.buildPayload();
  }
}
