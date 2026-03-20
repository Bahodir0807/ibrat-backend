export default () => ({
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET,
  dbUri: process.env.MONGO_URI,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  adminChatId: process.env.ADMIN_CHAT_ID,
  domain: process.env.DOMAIN,
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
});
