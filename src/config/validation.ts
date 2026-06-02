import * as Joi from 'joi';

const booleanEnvSchema = Joi.boolean()
  .truthy('true')
  .truthy('1')
  .truthy('yes')
  .truthy('on')
  .falsy('false')
  .falsy('0')
  .falsy('no')
  .falsy('off');

function configError(helpers: Joi.CustomHelpers, message: string) {
  return helpers.message({ custom: message });
}

export function validateProductionConfig(
  value: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
) {
  const env = value.NODE_ENV;
  const jwtSecret = String(value.JWT_SECRET ?? '');
  const refreshSecret = String(value.JWT_REFRESH_SECRET ?? '');
  const corsOrigins = String(value.CORS_ORIGINS ?? '');
  const rateLimitProvider = value.RATE_LIMIT_PROVIDER;

  if (rateLimitProvider === 'redis' && !value.REDIS_URL) {
    return configError(
      helpers,
      'REDIS_URL is required when RATE_LIMIT_PROVIDER=redis',
    );
  }

  if (env !== 'production' && env !== 'staging') {
    return value;
  }

  if (jwtSecret.length < 32) {
    return configError(
      helpers,
      'JWT_SECRET must be at least 32 characters in production/staging',
    );
  }

  if (refreshSecret.length < 32) {
    return configError(
      helpers,
      'JWT_REFRESH_SECRET must be at least 32 characters in production/staging',
    );
  }

  if (jwtSecret === refreshSecret) {
    return configError(
      helpers,
      'JWT_REFRESH_SECRET must differ from JWT_SECRET in production/staging',
    );
  }

  if (
    value.CORS_ALLOW_ALL_ORIGINS === true ||
    corsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .includes('*')
  ) {
    return configError(
      helpers,
      'Wildcard CORS is not allowed in production/staging',
    );
  }

  if (value.CORS_ALLOW_NO_ORIGIN === true) {
    return configError(
      helpers,
      'CORS_ALLOW_NO_ORIGIN must be false in production/staging',
    );
  }

  if (rateLimitProvider !== 'redis') {
    return configError(
      helpers,
      'RATE_LIMIT_PROVIDER=redis is required in production/staging',
    );
  }

  return value;
}

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production', 'staging')
    .default('development'),
  APP_NAME: Joi.string().trim().default('panda'),
  APP_VERSION: Joi.string().trim().default('0.0.1'),
  APP_HOST: Joi.string().trim().default('0.0.0.0'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().allow('').default(''),
  API_ENABLE_VERSIONING: booleanEnvSchema.default(false),
  API_DEFAULT_VERSION: Joi.string().trim().default('1'),
  BODY_LIMIT: Joi.string()
    .trim()
    .pattern(/^\d+\s*(b|kb|mb)$/i)
    .default('1mb'),
  TRUST_PROXY: booleanEnvSchema.default(false),
  JWT_SECRET: Joi.string().min(10).required(),
  JWT_EXPIRES_IN: Joi.string().trim().default('15m'),
  ACCESS_TOKEN_EXPIRES_IN: Joi.string().trim().optional(),
  JWT_REFRESH_SECRET: Joi.string().min(10).optional(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().trim().default('7d'),
  MONGO_URI: Joi.string().uri().required(),
  MONGO_DB_NAME: Joi.string().trim().optional(),
  DNS_SERVERS: Joi.string().trim().optional(),
  MONGO_MIN_POOL_SIZE: Joi.number().integer().min(0).default(1),
  MONGO_MAX_POOL_SIZE: Joi.number().integer().min(1).default(10),
  MONGO_AUTO_INDEX: booleanEnvSchema.optional(),
  TENANT_MODE: Joi.string()
    .valid('single-database', 'database-per-tenant-ready')
    .default('single-database'),
  TENANT_KEY_HEADER: Joi.string().trim().default('x-tenant-id'),
  BRANCH_KEY_HEADER: Joi.string().trim().default('x-branch-id'),
  TELEGRAM_BOT_TOKEN: Joi.string().min(10).optional(),
  TELEGRAM_NOTIFICATIONS_ENABLED: booleanEnvSchema.default(true),
  TELEGRAM_ADMIN_CHAT_ID: Joi.alternatives()
    .try(Joi.number(), Joi.string().pattern(/^\d+$/))
    .optional(),
  ADMIN_CHAT_ID: Joi.alternatives()
    .try(Joi.number(), Joi.string().pattern(/^\d+$/))
    .optional(),
  DOMAIN: Joi.string().uri().optional(),
  SELF_PING_URL: Joi.string().uri().optional(),
  SELF_PING_REQUIRED: booleanEnvSchema.default(false),
  TELEGRAM_WEBHOOK_PATH: Joi.string()
    .trim()
    .pattern(/^\/[^\s]*$/)
    .default('/bot'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  CORS_ALLOW_ALL_ORIGINS: booleanEnvSchema.optional(),
  CORS_ALLOW_NO_ORIGIN: booleanEnvSchema.default(false),
  RATE_LIMIT_PROVIDER: Joi.string().valid('memory', 'redis').optional(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .allow('')
    .optional(),
  PUBLIC_RATE_LIMIT_TTL: Joi.number().integer().min(1000).optional(),
  PUBLIC_RATE_LIMIT_LIMIT: Joi.number().integer().min(1).optional(),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_PUBLIC_AUTH_MAX: Joi.number().integer().min(1).default(10),
  ENABLE_SCHEDULER: booleanEnvSchema.default(false),
  SCHEDULER_DRY_RUN: booleanEnvSchema.default(false),
  PAYMENT_GENERATION_ENABLED: booleanEnvSchema.default(false),
  DEBT_AGING_ENABLED: booleanEnvSchema.default(false),
  PAYMENT_GENERATION_HOUR: Joi.number().integer().min(0).max(23).default(1),
  DEBT_AGING_HOUR: Joi.number().integer().min(0).max(23).default(2),
  DEBT_REMINDERS_ENABLED: booleanEnvSchema.default(false),
  DEBT_REMINDERS_HOUR: Joi.number().integer().min(0).max(23).default(10),
  SMS_ENABLED: booleanEnvSchema.default(false),
  SMS_PROVIDER: Joi.string().valid('mock').default('mock'),
  SMS_DRY_RUN: booleanEnvSchema.default(true),
  SMS_DEFAULT_LOCALE: Joi.string().valid('ru', 'uz', 'en').default('ru'),
  SMS_CENTER_NAME: Joi.string().trim().max(80).optional(),
  CENTER_NAME: Joi.string().trim().max(80).optional(),
  SMS_API_URL: Joi.string().uri().optional(),
  SMS_API_KEY: Joi.string().trim().optional(),
  SMS_SENDER: Joi.string().trim().max(50).optional(),
  SMS_MAX_DEBT_REMINDERS_PER_DAY: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(3),
}).custom(validateProductionConfig);
