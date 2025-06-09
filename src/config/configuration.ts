export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret',
  dbUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ibrat',
});
