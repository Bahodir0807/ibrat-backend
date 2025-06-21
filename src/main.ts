import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'; 
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  try {
    console.log('✅ Запуск приложения');
    console.log('MONGO_URI:', process.env.MONGO_URI);
    console.log('PORT:', process.env.PORT);
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN);

    const app = await NestFactory.create(AppModule);
    
    console.log('✅ Приложение создано');
    
    console.log('✅ Добавление фильтров');
    app.useGlobalFilters(new AllExceptionsFilter());
    
    console.log('✅ Добавление интерсепторов');
    app.useGlobalInterceptors(new LoggingInterceptor());
    
    console.log('✅ Добавление валидаторов');
    app.useGlobalPipes(new CustomValidationPipe());
    
    await app.listen(process.env.PORT || 3000, '0.0.0.0');
    console.log(`🚀 Сервер запущен на http://localhost:${process.env.PORT || 3000}`);
  } catch (error) {
    console.error('❌ Ошибка при запуске приложения:', error);
    process.exit(1);
  }
}
bootstrap();