import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PhoneRequestService } from './phone-request.service';
import { CreatePhoneRequestDto } from './dto/create-phone-request.dto';
import { HandlePhoneRequestDto } from './dto/handle-phone-request.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { PhoneRequestListQueryDto } from './dto/phone-request-list-query.dto';
import { TelegramIdQueryDto } from '../common/dto/telegram-id-query.dto';

@Controller('phone-request')
export class PhoneRequestController {
  constructor(private readonly service: PhoneRequestService) {}

  @Public()
  @Post()
  create(@Body() dto: CreatePhoneRequestDto) {
    return this.service.create(dto);
  }

  @Patch()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  handle(@Body() dto: HandlePhoneRequestDto) {
    return this.service.handle(dto);
  }

  @Public()
  @Get()
  getById(@Query() query: TelegramIdQueryDto) {
    return this.service.getByTelegramId(query.telegramId);
  }

  @Get('pending')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  getPending(@Query() query: PhoneRequestListQueryDto) {
    return this.service.getPending(query);
  }

  @Public()
  @Post('tg-request')
  createFromTelegram(@Body() body: CreatePhoneRequestDto) {
    return this.service.create(body);
  }

  @Public()
  @Get('tg-check')
  checkFromTelegram(@Query() query: TelegramIdQueryDto) {
    return this.service.getByTelegramId(query.telegramId);
  }
}
