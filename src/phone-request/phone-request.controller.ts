import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { PhoneRequestService } from './phone-request.service';
import { CreatePhoneRequestDto } from './dto/create-phone-request.dto';
import { HandlePhoneRequestDto } from './dto/handle-phone-request.dto';

@Controller('phone-request')
export class PhoneRequestController {
  constructor(private readonly service: PhoneRequestService) {}

  @Post()
  create(@Body() dto: CreatePhoneRequestDto) {
    return this.service.create(dto);
  }

  @Patch()
  handle(@Body() dto: HandlePhoneRequestDto) {
    return this.service.handle(dto);
  }

  @Get()
  getById(@Query('telegramId') telegramId: string) {
    return this.service.getById(telegramId);
  }

  @Get('pending')
  getPending() {
    return this.service.getPending();
  }

  @Post('tg-request')
  createFromTelegram(@Body() body: { phone: string; name: string; telegramId: string }) {
    return this.service.create(body);
  }

  @Get('tg-check')
  checkFromTelegram(@Query('telegramId') telegramId: string) {
    return this.service.getById(telegramId);
  }
}
