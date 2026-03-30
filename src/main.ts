import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { TelegramService } from './telegram/telegram.service';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());

  const allowedOrigins = configService.get<string[]>('corsOrigins') ?? [];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();
  const webhookPath = '/bot';
  const domain = configService.get<string>('domain');

  if (bot) {
    app.use(webhookPath, bot.webhookCallback(webhookPath));

    try {
      logger.log('Checking Telegram API connection');
      await bot.telegram.getMe();

      if (domain) {
        await bot.telegram.setWebhook(`${domain}${webhookPath}`);
        logger.log(`Telegram webhook configured at ${domain}${webhookPath}`);
      } else {
        logger.warn('DOMAIN is not set, Telegram webhook configuration skipped');
      }
    } catch (error) {
      logger.error(
        'Telegram API initialization failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  } else {
    logger.warn('Telegram bot is disabled because TELEGRAM_BOT_TOKEN is not set');
  }

  const port = configService.getOrThrow<number>('port');
  await app.listen(port, '0.0.0.0');
  logger.log(`Server started on port ${port}`);
}

bootstrap();
