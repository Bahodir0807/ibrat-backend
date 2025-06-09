import { ValidationPipe, BadRequestException } from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true, 
      forbidNonWhitelisted: true, 
      transform: true, 
      exceptionFactory: (errors) => {
        const messages = errors.map(err => {
          const constraints = err.constraints ? Object.values(err.constraints).join(', ') : '';
          return `${err.property} - ${constraints}`;
        });
        return new BadRequestException(messages);
      },
    });
  }
}
