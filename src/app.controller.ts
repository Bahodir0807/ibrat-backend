import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('ping')
  ping() {
    return { message: 'pong' };
  }

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
