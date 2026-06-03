import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app.module';
import { PaymentsModule } from './payments/payments.module';
import { TelegramModule } from './telegram/telegram.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsSchedulerModule } from './scheduler/scheduler.module';
import { BranchesModule } from './branches/branches.module';
import configuration from './config/configuration';
import { configValidationSchema } from './config/validation';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';

type ForwardRefLike = { forwardRef: () => unknown };

function getImports(moduleClass: unknown): unknown[] {
  return (Reflect.getMetadata('imports', moduleClass as object) ??
    []) as unknown[];
}

function unwrapImport(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'forwardRef' in value &&
    typeof (value as ForwardRefLike).forwardRef === 'function'
  ) {
    return (value as ForwardRefLike).forwardRef();
  }

  return value;
}

describe('production deploy startup hardening', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('critical Nest module graph has no undefined imports', () => {
    const modules = [
      AppModule,
      PaymentsModule,
      TelegramModule,
      NotificationsModule,
      JobsSchedulerModule,
      BranchesModule,
    ];

    for (const moduleClass of modules) {
      const imports = getImports(moduleClass).map(unwrapImport);
      expect(imports).not.toContain(undefined);
      expect(imports).not.toContain(null);
    }

    expect(getImports(AppModule).map(unwrapImport)).toEqual(
      expect.arrayContaining([
        PaymentsModule,
        TelegramModule,
        NotificationsModule,
        JobsSchedulerModule,
        BranchesModule,
      ]),
    );
  });

  it('compiles production-like config with Render aliases and safe defaults', async () => {
    process.env = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(32),
      REFRESH_JWT_SECRET: 'b'.repeat(32),
      MONGODB_URI: 'mongodb://127.0.0.1:27017/ibrat',
      CORS_ORIGINS: 'https://crm.example.com',
      CORS_ALLOW_NO_ORIGIN: 'false',
      RATE_LIMIT_PROVIDER: 'redis',
      REDIS_URL: 'redis://127.0.0.1:6379',
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [configuration],
          validationSchema: configValidationSchema,
        }),
        AppConfigModule,
      ],
    }).compile();
    const appConfig = moduleRef.get(AppConfigService);

    expect(appConfig.databaseUri).toBe('mongodb://127.0.0.1:27017/ibrat');
    expect(appConfig.jwtRefreshSecret).toBe('b'.repeat(32));
    expect(appConfig.scheduler.enabled).toBe(false);
    expect(appConfig.sms.enabled).toBe(false);
    expect(appConfig.sms.provider).toBe('mock');
    expect(appConfig.sms.dryRun).toBe(true);

    await moduleRef.close();
  });

  it('package scripts are compatible with built dist startup', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.build).toBe('nest build');
    expect(packageJson.scripts['start:prod']).toBe('node dist/src/main.js');
  });
});
