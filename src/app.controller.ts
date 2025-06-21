import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  @Public()
  @Get('ping')
  ping() {
    return { message: 'pong' };
  }  
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
 