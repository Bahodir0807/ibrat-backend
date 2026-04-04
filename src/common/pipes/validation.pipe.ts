import { ValidationPipe, BadRequestException } from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      whitelist: true, 
      forbidNonWhitelisted: true, 
      transform: true, 
      exceptionFactory: errors => {
        const messages = errors.flatMap(error => {
          const directConstraints = error.constraints ? Object.values(error.constraints) : [];
          const childConstraints = (error.children ?? []).flatMap(child =>
            child.constraints ? Object.values(child.constraints) : [],
          );

          const constraints = [...directConstraints, ...childConstraints];
          if (constraints.length === 0) {
            return [`${error.property} is invalid`];
          }

          return constraints.map(message => `${error.property} - ${message}`);
        });

        return new BadRequestException(messages);
      },
    });
  }
}
