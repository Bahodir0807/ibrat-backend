import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import configuration, { AppEnvironment, RuntimeConfiguration, TenantMode } from './configuration';

type PublicRuntimeMetadata = {
  name: string;
  version: string;
  environment: AppEnvironment;
};

type OperationalRuntimeMetadata = {
  branchAware: boolean;
  tenantMode: TenantMode;
  tenantKeyHeader: string;
  branchKeyHeader: string;
};

@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: ConfigService<RuntimeConfiguration, true>,
  ) {}

  get environment(): AppEnvironment {
    return this.configService.getOrThrow<AppEnvironment>('environment');
  }

  get isProductionLike(): boolean {
    return this.environment === 'production' || this.environment === 'staging';
  }

  get app(): RuntimeConfiguration['app'] {
    return this.configService.getOrThrow<RuntimeConfiguration['app']>('app');
  }

  get auth(): RuntimeConfiguration['auth'] {
    return this.configService.getOrThrow<RuntimeConfiguration['auth']>('auth');
  }

  get database(): RuntimeConfiguration['database'] {
    return this.configService.getOrThrow<RuntimeConfiguration['database']>('database');
  }

  get cors(): RuntimeConfiguration['cors'] {
    return this.configService.getOrThrow<RuntimeConfiguration['cors']>('cors');
  }

  get telegram(): RuntimeConfiguration['telegram'] {
    return this.configService.getOrThrow<RuntimeConfiguration['telegram']>('telegram');
  }

  get operational(): RuntimeConfiguration['operational'] {
    return this.configService.getOrThrow<RuntimeConfiguration['operational']>('operational');
  }

  get appName(): string {
    return this.app.name;
  }

  get appVersion(): string {
    return this.app.version;
  }

  get host(): string {
    return this.app.host;
  }

  get port(): number {
    return this.app.port;
  }

  get globalPrefix(): string {
    return this.app.globalPrefix;
  }

  get apiVersioningEnabled(): boolean {
    return this.app.enableVersioning;
  }

  get apiDefaultVersion(): string {
    return this.app.defaultVersion;
  }

  get bodyLimit(): string {
    return this.app.bodyLimit;
  }

  get trustProxy(): boolean {
    return this.app.trustProxy;
  }

  get databaseUri(): string {
    return this.database.uri;
  }

  get databaseName(): string | undefined {
    return this.database.dbName;
  }

  get databaseMinPoolSize(): number {
    return this.database.minPoolSize;
  }

  get databaseMaxPoolSize(): number {
    return this.database.maxPoolSize;
  }

  get databaseAutoIndex(): boolean {
    return this.database.autoIndex;
  }

  get jwtSecret(): string {
    return this.auth.jwtSecret;
  }

  get jwtExpiresIn(): string {
    return this.auth.tokenTtl;
  }

  get jwtRefreshSecret(): string {
    return this.auth.refreshTokenSecret;
  }

  get jwtRefreshExpiresIn(): string {
    return this.auth.refreshTokenTtl;
  }

  get telegramBotToken(): string | undefined {
    return this.telegram.botToken;
  }

  get telegramAdminChatId(): number | undefined {
    return this.telegram.adminChatId;
  }

  get telegramWebhookBaseUrl(): string | undefined {
    return this.telegram.domain;
  }

  get telegramWebhookPath(): string {
    return this.telegram.webhookPath;
  }

  get isBranchAware(): boolean {
    return this.operational.branchAware;
  }

  get tenantMode(): TenantMode {
    return this.operational.tenantMode;
  }

  get tenantKeyHeader(): string {
    return this.operational.tenantKeyHeader;
  }

  get branchKeyHeader(): string {
    return this.operational.branchKeyHeader;
  }

  getPublicMetadata(): PublicRuntimeMetadata {
    return {
      name: this.appName,
      version: this.appVersion,
      environment: this.environment,
    };
  }

  getOperationalMetadata(): OperationalRuntimeMetadata {
    return {
      branchAware: this.isBranchAware,
      tenantMode: this.tenantMode,
      tenantKeyHeader: this.tenantKeyHeader,
      branchKeyHeader: this.branchKeyHeader,
    };
  }

  createMongooseOptions(): MongooseModuleOptions {
    return {
      uri: this.databaseUri,
      ...(this.databaseName ? { dbName: this.databaseName } : {}),
      minPoolSize: this.databaseMinPoolSize,
      maxPoolSize: this.databaseMaxPoolSize,
      autoIndex: this.databaseAutoIndex,
    };
  }

  createCorsOptions(): CorsOptions {
    const cors = this.cors;

    return {
      origin: (origin, callback) => {
        if (!origin) {
          if (cors.allowNoOrigin) {
            callback(null, true);
            return;
          }

          callback(new Error('Requests without Origin header are not allowed by CORS'), false);
          return;
        }

        if (cors.allowAllOrigins || cors.origins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
      },
      credentials: cors.credentials,
      methods: cors.methods,
      allowedHeaders: cors.allowedHeaders,
    };
  }
}

export type { PublicRuntimeMetadata };
export { configuration };
