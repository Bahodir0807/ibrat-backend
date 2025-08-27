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

  // Настройка CORS
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = ['https://r.sultonoway.uz'];
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Access-Control-Allow-Headers',
    ],
    exposedHeaders: ['Access-Control-Allow-Origin'],
  });

  // Telegram webhook
  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();
  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://b.sultonoway.uz';

  app.use(webhookPath, bot.webhookCallback(webhookPath));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server запущен на http://localhost:${port}`);
}

bootstrap();
