import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import * as dotenv from 'dotenv';
import { TelegramService } from './telegram/telegram.service';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());
  app.enableCors({
  origin: [
    'https://sultonoway.uz',
    'http://localhost:5173',
    'https://b.sultonoway.uz',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
  ],
  exposedHeaders: ['Access-Control-Allow-Origin'],
});


  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();
  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://b.sultonoway.uz';

  app.use(webhookPath, bot.webhookCallback(webhookPath));

  try {
    console.log('⏳ Проверяю подключение к Telegram API...');
    await bot.telegram.getMe();
    await bot.telegram.setWebhook(`${domain}${webhookPath}`);
    console.log(`✅ Telegram webhook установлен: ${domain}${webhookPath}`);
  } catch (err) {
    console.error('⚠️ Ошибка при подключении к Telegram API:', err.message);
    console.error('🚨 Бот не запущен, но сервер продолжает работать.');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server запущен: ${domain}  Port: ${port}`);
}

bootstrap();
