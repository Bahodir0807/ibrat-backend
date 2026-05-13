import { AppConfigService } from './app-config.service';

function appConfigWithCors(cors: {
  origins: string[];
  allowAllOrigins: boolean;
  allowNoOrigin: boolean;
}) {
  return new AppConfigService({
    getOrThrow: jest.fn((key: string) => {
      if (key === 'cors') {
        return {
          ...cors,
          credentials: true,
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'Origin'],
        };
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as any);
}

function resolveOrigin(
  origin: string | undefined,
  cors: ReturnType<AppConfigService['createCorsOptions']>,
): Promise<{ error: Error | null; allowed?: unknown }> {
  return new Promise((resolve) => {
    const originCallback = cors.origin;
    if (typeof originCallback !== 'function') {
      throw new Error('Expected CORS origin callback');
    }

    originCallback(origin as string, (error, allowed) => {
      resolve({ error, allowed });
    });
  });
}

describe('AppConfigService CORS options', () => {
  it('omits CORS headers for no-origin requests without failing the request', async () => {
    const appConfig = appConfigWithCors({
      origins: ['https://app.example.com'],
      allowAllOrigins: false,
      allowNoOrigin: false,
    });

    await expect(
      resolveOrigin(undefined, appConfig.createCorsOptions()),
    ).resolves.toEqual({
      error: null,
      allowed: false,
    });
  });

  it('omits CORS headers for disallowed origins without failing the request', async () => {
    const appConfig = appConfigWithCors({
      origins: ['https://app.example.com'],
      allowAllOrigins: false,
      allowNoOrigin: false,
    });

    await expect(
      resolveOrigin('https://evil.example.com', appConfig.createCorsOptions()),
    ).resolves.toEqual({
      error: null,
      allowed: false,
    });
  });

  it('allows configured origins', async () => {
    const appConfig = appConfigWithCors({
      origins: ['https://app.example.com'],
      allowAllOrigins: false,
      allowNoOrigin: false,
    });

    await expect(
      resolveOrigin('https://app.example.com', appConfig.createCorsOptions()),
    ).resolves.toEqual({
      error: null,
      allowed: true,
    });
  });

  it('allows local Vite origins and OPTIONS preflight configuration in development', async () => {
    const appConfig = appConfigWithCors({
      origins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      allowAllOrigins: false,
      allowNoOrigin: true,
    });
    const corsOptions = appConfig.createCorsOptions();

    await expect(
      resolveOrigin('http://localhost:5173', corsOptions),
    ).resolves.toEqual({
      error: null,
      allowed: true,
    });
    await expect(
      resolveOrigin('http://127.0.0.1:5173', corsOptions),
    ).resolves.toEqual({
      error: null,
      allowed: true,
    });
    expect(corsOptions.methods).toContain('OPTIONS');
    expect(corsOptions.allowedHeaders).toEqual(
      expect.arrayContaining(['Content-Type', 'Authorization', 'Origin']),
    );
  });
});
