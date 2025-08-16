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
    origin: ['http://localhost:5173', 'https://r.sultonoway.uz'],
    credentials: true
  }); 

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();

  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://b.sultonoway.uz';

  console.log('📡 DOMAIN:', domain);

  app.use(bot.webhookCallback(webhookPath));

  try {
    await bot.telegram.setWebhook(`${domain}${webhookPath}`);
    console.log(`✅ Webhook установлен: ${domain}${webhookPath}`);
  } catch (err) {
    console.error('❌ Ошибка установки webhook:', err);
  }

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();
