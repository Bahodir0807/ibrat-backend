import { configValidationSchema } from './validation';

describe('configuration validation', () => {
  const base = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    MONGO_URI: 'mongodb://127.0.0.1:27017/ibrat',
    CORS_ORIGINS: 'https://crm.example.com',
    CORS_ALLOW_NO_ORIGIN: false,
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
});
