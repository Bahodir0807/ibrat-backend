import { configValidationSchema } from './validation';

describe('configuration validation', () => {
  const base = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
    CORS_ORIGINS: 'https://crm.example.com',
    CORS_ALLOW_NO_ORIGIN: false,
    RATE_LIMIT_PROVIDER: 'redis',
    REDIS_URL: 'redis://127.0.0.1:6379',
  };

  it('rejects wildcard CORS in production', () => {
    const result = configValidationSchema.validate({
      ...base,
      CORS_ORIGINS: '*',
    });

    expect(result.error).toBeDefined();
  });

  it('rejects shared access and refresh secrets in production', () => {
    const shared = 'a'.repeat(32);
    const result = configValidationSchema.validate({
      ...base,
      JWT_SECRET: shared,
      JWT_REFRESH_SECRET: shared,
    });

    expect(result.error).toBeDefined();
  });

  it('accepts production-safe configuration', () => {
    const result = configValidationSchema.validate(base);

    expect(result.error).toBeUndefined();
  });

  it('rejects memory rate limiting in production', () => {
    const result = configValidationSchema.validate({
      ...base,
      RATE_LIMIT_PROVIDER: 'memory',
    });

    expect(result.error?.message).toContain(
      'RATE_LIMIT_PROVIDER=redis is required',
    );
  });

  it('rejects missing rate limit provider in production', () => {
    const { RATE_LIMIT_PROVIDER, ...config } = base;
    const result = configValidationSchema.validate(config);

    expect(result.error?.message).toContain(
      'RATE_LIMIT_PROVIDER=redis is required',
    );
  });

  it('rejects missing Redis URL when production rate limiting uses redis', () => {
    const { REDIS_URL, ...config } = base;
    const result = configValidationSchema.validate(config);

    expect(result.error?.message).toContain('REDIS_URL is required');
  });

  it('allows memory rate limiting in development', () => {
    const result = configValidationSchema.validate({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev_secret_key',
      MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
      RATE_LIMIT_PROVIDER: 'memory',
    });

    expect(result.error).toBeUndefined();
  });

  it('rejects redis provider without Redis URL in development', () => {
    const result = configValidationSchema.validate({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev_secret_key',
      MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
      RATE_LIMIT_PROVIDER: 'redis',
    });

    expect(result.error?.message).toContain('REDIS_URL is required');
  });

  it('allows mock SMS provider without provider credentials', () => {
    const result = configValidationSchema.validate({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev_secret_key',
      MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
      SMS_PROVIDER: 'mock',
      SMS_ENABLED: false,
    });

    expect(result.error).toBeUndefined();
    expect(result.value.SMS_PROVIDER).toBe('mock');
    expect(result.value.SMS_DEFAULT_LOCALE).toBe('ru');
  });

  it('rejects unsupported SMS providers safely', () => {
    const result = configValidationSchema.validate({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev_secret_key',
      MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
      SMS_PROVIDER: 'real-provider',
      SMS_API_URL: 'https://sms.example.com',
      SMS_API_KEY: 'secret',
    });

    expect(result.error?.message).toContain('SMS_PROVIDER');
  });
});
