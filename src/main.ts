import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { RequestMethod, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { TelegramService } from './telegram/telegram.service';
import { AppConfigService } from './config/app-config.service';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const appConfig = app.get(AppConfigService);

  app.enableShutdownHooks();
  app.disable('x-powered-by');

  if (appConfig.trustProxy) {
    app.set('trust proxy', true);
  }

  app.use(json({ limit: appConfig.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: appConfig.bodyLimit }));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());

  if (appConfig.globalPrefix) {
    app.setGlobalPrefix(appConfig.globalPrefix, {
      exclude: [
        { path: 'ping', method: RequestMethod.GET },
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
      ],
    });
  }

  if (appConfig.apiVersioningEnabled) {
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: appConfig.apiDefaultVersion,
    });
  }

  app.enableCors(appConfig.createCorsOptions());

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();
  const webhookPath = appConfig.telegramWebhookPath;
  const webhookBaseUrl = appConfig.telegramWebhookBaseUrl;

  if (bot) {
    app.use(webhookPath, bot.webhookCallback(webhookPath));

    try {
      logger.log('Checking Telegram API connection');
      await bot.telegram.getMe();

      if (webhookBaseUrl) {
        await bot.telegram.setWebhook(`${webhookBaseUrl}${webhookPath}`);
        logger.log(`Telegram webhook configured at ${webhookBaseUrl}${webhookPath}`);
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

  await app.listen(appConfig.port, appConfig.host);
  logger.log(
    `Server started on ${appConfig.host}:${appConfig.port}${appConfig.globalPrefix ? `/${appConfig.globalPrefix}` : ''}`,
  );
}

bootstrap();
