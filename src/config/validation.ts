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
  BODY_LIMIT: Joi.string().trim().pattern(/^\d+\s*(b|kb|mb)$/i).default('1mb'),
  TRUST_PROXY: booleanEnvSchema.default(false),
  JWT_SECRET: Joi.string().min(10).required(),
  JWT_EXPIRES_IN: Joi.string().trim().default('15m'),
  ACCESS_TOKEN_EXPIRES_IN: Joi.string().trim().optional(),
  JWT_REFRESH_SECRET: Joi.string().min(10).optional(),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().trim().default('7d'),
  MONGO_URI: Joi.string().uri().required(),
  MONGO_DB_NAME: Joi.string().trim().optional(),
  MONGO_MIN_POOL_SIZE: Joi.number().integer().min(0).default(1),
  MONGO_MAX_POOL_SIZE: Joi.number().integer().min(1).default(10),
  MONGO_AUTO_INDEX: booleanEnvSchema.optional(),
  TENANT_MODE: Joi.string()
    .valid('single-database', 'database-per-tenant-ready')
    .default('single-database'),
  TENANT_KEY_HEADER: Joi.string().trim().default('x-tenant-id'),
  BRANCH_KEY_HEADER: Joi.string().trim().default('x-branch-id'),
  TELEGRAM_BOT_TOKEN: Joi.string().min(10).optional(),
  ADMIN_CHAT_ID: Joi.alternatives()
    .try(Joi.number(), Joi.string().pattern(/^\d+$/))
    .optional(),
  DOMAIN: Joi.string().uri().optional(),
  TELEGRAM_WEBHOOK_PATH: Joi.string().trim().pattern(/^\/[^\s]*$/).default('/bot'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  CORS_ALLOW_ALL_ORIGINS: booleanEnvSchema.optional(),
  CORS_ALLOW_NO_ORIGIN: booleanEnvSchema.default(true),
});
