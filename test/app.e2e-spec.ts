import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      controllers: [AppController, HealthController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHello: () => ({ status: 'ok' }),
          },
        },
        {
          provide: HealthService,
          useValue: {
            getLiveness: () => ({
              status: 'ok',
              timestamp: '2026-04-18T00:00:00.000Z',
              uptime: 1,
              service: {
                name: 'panda',
                version: '0.0.1',
                environment: 'test',
              },
              operational: {
                branchAware: true,
                tenantMode: 'single-database',
                tenantKeyHeader: 'x-tenant-id',
                branchKeyHeader: 'x-branch-id',
              },
            }),
            getReadiness: () => ({
              status: 'ok',
              timestamp: '2026-04-18T00:00:00.000Z',
              uptime: 1,
              service: {
                name: 'panda',
                version: '0.0.1',
                environment: 'test',
              },
              operational: {
                branchAware: true,
                tenantMode: 'single-database',
                tenantKeyHeader: 'x-tenant-id',
                branchKeyHeader: 'x-branch-id',
              },
              checks: {
                database: {
                  status: 'up',
                  readyState: 1,
                },
              },
            }),
            getHealth: () => ({
              status: 'ok',
              timestamp: '2026-04-18T00:00:00.000Z',
              uptime: 1,
              service: {
                name: 'panda',
                version: '0.0.1',
                environment: 'test',
              },
              operational: {
                branchAware: true,
                tenantMode: 'single-database',
                tenantKeyHeader: 'x-tenant-id',
                branchKeyHeader: 'x-branch-id',
              },
              checks: {
                database: {
                  status: 'up',
                  readyState: 1,
                },
              },
            }),
            getVersion: () => ({
              name: 'panda',
              version: '0.0.1',
              environment: 'test',
              buildHash: 'test',
              buildTime: '2026-04-18T00:00:00.000Z',
              timestamp: '2026-04-18T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('/ping (GET)', async () => {
    await request(app.getHttpServer())
      .get('/ping')
      .expect(200)
      .expect({ message: 'pong' });
  });

  it('/ (GET)', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/health/live (GET)', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({
        status: 'ok',
        timestamp: '2026-04-18T00:00:00.000Z',
        uptime: 1,
        service: {
          name: 'panda',
          version: '0.0.1',
          environment: 'test',
        },
        operational: {
          branchAware: true,
          tenantMode: 'single-database',
          tenantKeyHeader: 'x-tenant-id',
          branchKeyHeader: 'x-branch-id',
        },
      });
  });

  it('/health/ready (GET)', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'ok',
        timestamp: '2026-04-18T00:00:00.000Z',
        uptime: 1,
        service: {
          name: 'panda',
          version: '0.0.1',
          environment: 'test',
        },
        operational: {
          branchAware: true,
          tenantMode: 'single-database',
          tenantKeyHeader: 'x-tenant-id',
          branchKeyHeader: 'x-branch-id',
        },
        checks: {
          database: {
            status: 'up',
            readyState: 1,
          },
        },
      });
  });

  it('/version (GET)', async () => {
    await request(app.getHttpServer())
      .get('/version')
      .expect(200)
      .expect({
        name: 'panda',
        version: '0.0.1',
        environment: 'test',
        buildHash: 'test',
        buildTime: '2026-04-18T00:00:00.000Z',
        timestamp: '2026-04-18T00:00:00.000Z',
      });
  });
});
