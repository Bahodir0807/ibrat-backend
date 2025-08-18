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

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://r.sultonoway.uz');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,Origin,X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
  
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
  
    next();
  });
  
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = ['http://localhost:5173', 'https://r.sultonoway.uz'];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Access-Control-Allow-Headers'],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  }); 

  const telegramService = app.get(TelegramService);
  const bot = telegramService.getBot();

  const webhookPath = '/bot';
  const domain = process.env.DOMAIN || 'https://b.sultonoway.uz';

  console.log('📡 DOMAIN:', domain);

  app.use(bot.webhookCallback(webhookPath));

app.use((req, res) => {
  const accept = (req.headers.accept || '').toString();

  if (accept.includes('application/json') || req.xhr || req.headers['content-type']?.includes('application/json')) {
    return res.status(404).json({
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      message: 'Not Found'
    });
  }

  res.status(404).send(`
<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 — Тут пусто</title>
<style>
  body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background:#0f172a;color:#fff;flex-direction:column;text-align:center}
  h1{font-size:80px;margin:0;letter-spacing:-5px;color:#fb7185}
  p{margin:10px 0 0;color:#94a3b8;font-size:18px}
  a{margin-top:20px;text-decoration:none;color:#fff;background:#3b82f6;padding:10px 20px;border-radius:8px;transition:0.3s}
  a:hover{background:#2563eb}
</style>
</head>
<body>
  <h1>404</h1>
  <p>Страница не найдена.</p>
  <a href="/">Вернуться на главную</a>
</body>
</html>
  `);
});


  try {
    await bot.telegram.setWebhook(`${domain}${webhookPath}`);
    console.log(`✅ Webhook установлен: ${domain}${webhookPath}`);
  } catch (err) {
    console.error('❌ Ошибка установки webhook:', err);
  }

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();
