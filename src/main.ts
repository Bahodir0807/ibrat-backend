import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'; 
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { RolesGuard } from './roles/roles.guard';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalPipes(new CustomValidationPipe());

  app.useGlobalGuards(new RolesGuard(app.get(Reflector)));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);

  console.log(`🚀 Server started on http://localhost:${port}`);
}
bootstrap();

