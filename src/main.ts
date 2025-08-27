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

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();
  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://b.sultonoway.uz';

  app.use(bot.webhookCallback(webhookPath));

  // try {
  //   await bot.telegram.setWebhook(`${domain}${webhookPath}`);
  //   console.log(`✅ Webhook установлен: ${domain}${webhookPath}`);
  // } catch (err) {
  //   console.error('❌ Ошибка установки webhook:', err);
  // }

  // app.use((req, res) => {
  //   res.status(404);
  //   const accept = (req.headers.accept || '').toString();
  //   if (accept.includes('application/json') || req.xhr || req.headers['content-type']?.includes('application/json')) {
  //     return res.json({
  //       statusCode: 404,
  //       timestamp: new Date().toISOString(),
  //       path: req.originalUrl,
  //       message: 'Not Found',
  //     });
  //   }

  //   res.send(`
  //     <!doctype html>
  //     <html lang="ru">
  //     <head>
  //       <meta charset="utf-8">
  //       <title>404</title>
  //       <style>
  //         body { text-align:center; margin-top:50px; font-family: Arial, sans-serif; }
  //         h1 { font-size: 48px; color: #e74c3c; }
  //         p { font-size: 20px; }
  //         a { color: #3498db; text-decoration: none; }
  //         a:hover { text-decoration: underline; }
  //       </style>
  //     </head>
  //     <body>
  //       <h1>404 — Тут пусто</h1>
  //       <p>Страница не найдена.</p>
  //       <a href="/">На главную</a>
  //     </body>
  //     </html>
  //   `);
  // });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server запущен на http://localhost:${port}`);
}

bootstrap();
