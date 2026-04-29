const APP_ENVIRONMENTS = ['development', 'test', 'production', 'staging'] as const;
const TENANT_MODES = ['single-database', 'database-per-tenant-ready'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type TenantMode = (typeof TENANT_MODES)[number];

const DEFAULT_APP_NAME = 'panda';
const DEFAULT_APP_VERSION = '0.0.1';
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;
const DEFAULT_BODY_LIMIT = '1mb';
const DEFAULT_TELEGRAM_WEBHOOK_PATH = '/bot';
const DEFAULT_TENANT_MODE: TenantMode = 'single-database';
const DEFAULT_TENANT_KEY_HEADER = 'x-tenant-id';
const DEFAULT_BRANCH_KEY_HEADER = 'x-branch-id';
const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
];

function normalizeString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function normalizeEnvironment(value?: string): AppEnvironment {
  const normalized = value?.trim().toLowerCase();

  if (normalized && APP_ENVIRONMENTS.includes(normalized as AppEnvironment)) {
    return normalized as AppEnvironment;
  }

  return 'development';
}

function normalizeTenantMode(value?: string): TenantMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized && TENANT_MODES.includes(normalized as TenantMode)) {
    return normalized as TenantMode;
  }

  return DEFAULT_TENANT_MODE;
}

function normalizeNumber(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizePrefix(value?: string): string {
  const normalized = normalizeString(value);

  if (!normalized) {
    return '';
  }

  return normalized.replace(/^\/+|\/+$/g, '');
}

function normalizeWebhookPath(value?: string): string {
  const normalized = normalizeString(value);

  if (!normalized) {
    return DEFAULT_TELEGRAM_WEBHOOK_PATH;
  }

  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return path.replace(/\/+$/g, '') || DEFAULT_TELEGRAM_WEBHOOK_PATH;
}

function parseCsv(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseOrigins(value?: string) {
  const origins = parseCsv(value);
  const hasWildcard = origins.includes('*');

  return {
    origins: origins.filter(origin => origin !== '*'),
    hasWildcard,
  };
}

export function getEnvFilePaths(nodeEnv = process.env.NODE_ENV): string[] {
  const environment = normalizeEnvironment(nodeEnv);
  const envFilePaths = [`.env.${environment}.local`, `.env.${environment}`];

  if (environment !== 'test') {
    envFilePaths.push('.env.local');
  }

  envFilePaths.push('.env');

  return Array.from(new Set(envFilePaths));
}

const configuration = () => {
  const environment = normalizeEnvironment(process.env.NODE_ENV);
  const isProductionLike = environment === 'production' || environment === 'staging';
  const tenantMode = normalizeTenantMode(process.env.TENANT_MODE);
  const parsedOrigins = parseOrigins(process.env.CORS_ORIGINS);
  const allowAllOrigins = parsedOrigins.hasWildcard
    || normalizeBoolean(
      process.env.CORS_ALLOW_ALL_ORIGINS,
      !isProductionLike && parsedOrigins.origins.length === 0,
    );

  return {
    environment,
    app: {
      name: normalizeString(process.env.APP_NAME) ?? DEFAULT_APP_NAME,
      version: normalizeString(process.env.APP_VERSION) ?? DEFAULT_APP_VERSION,
      host: normalizeString(process.env.APP_HOST) ?? DEFAULT_HOST,
      port: Number(process.env.PORT ?? DEFAULT_PORT),
      globalPrefix: normalizePrefix(process.env.API_PREFIX),
      enableVersioning: normalizeBoolean(process.env.API_ENABLE_VERSIONING, false),
      defaultVersion: normalizeString(process.env.API_DEFAULT_VERSION) ?? '1',
      bodyLimit: normalizeString(process.env.BODY_LIMIT) ?? DEFAULT_BODY_LIMIT,
      trustProxy: normalizeBoolean(process.env.TRUST_PROXY, isProductionLike),
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET as string,
      tokenTtl:
        normalizeString(process.env.ACCESS_TOKEN_EXPIRES_IN)
        ?? normalizeString(process.env.JWT_EXPIRES_IN)
        ?? '15m',
      refreshTokenSecret:
        normalizeString(process.env.JWT_REFRESH_SECRET)
        ?? (process.env.JWT_SECRET as string),
      refreshTokenTtl: normalizeString(process.env.REFRESH_TOKEN_EXPIRES_IN) ?? '7d',
    },
    database: {
      uri: process.env.MONGO_URI as string,
      dbName: normalizeString(process.env.MONGO_DB_NAME),
      minPoolSize: normalizeNumber(process.env.MONGO_MIN_POOL_SIZE, 1),
      maxPoolSize: normalizeNumber(process.env.MONGO_MAX_POOL_SIZE, 10),
      autoIndex: normalizeBoolean(process.env.MONGO_AUTO_INDEX, !isProductionLike),
    },
    cors: {
      origins: parsedOrigins.origins,
      allowAllOrigins,
      allowNoOrigin: normalizeBoolean(process.env.CORS_ALLOW_NO_ORIGIN, true),
      credentials: true,
      methods: DEFAULT_ALLOWED_METHODS,
      allowedHeaders: DEFAULT_ALLOWED_HEADERS,
    },
    telegram: {
      botToken: normalizeString(process.env.TELEGRAM_BOT_TOKEN),
      adminChatId: process.env.ADMIN_CHAT_ID
        ? Number(process.env.ADMIN_CHAT_ID)
        : undefined,
      domain: normalizeString(process.env.DOMAIN),
      webhookPath: normalizeWebhookPath(process.env.TELEGRAM_WEBHOOK_PATH),
    },
    operational: {
      branchAware: true,
      tenantMode,
      tenantKeyHeader:
        normalizeString(process.env.TENANT_KEY_HEADER) ?? DEFAULT_TENANT_KEY_HEADER,
      branchKeyHeader:
        normalizeString(process.env.BRANCH_KEY_HEADER) ?? DEFAULT_BRANCH_KEY_HEADER,
    },
  };
};

export type RuntimeConfiguration = ReturnType<typeof configuration>;
export default configuration;
