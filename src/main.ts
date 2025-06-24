import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramService } from './telegram/telegram.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'; 
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();

  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://ibrat.onrender.com';
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  
  await bot.telegram.setWebhook(`${domain}${webhookPath}`);
  app.use(bot.webhookCallback(webhookPath));

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}
bootstrap();
