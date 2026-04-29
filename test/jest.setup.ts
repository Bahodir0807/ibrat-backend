import 'reflect-metadata';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_12345';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ibrat_test';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || '';
