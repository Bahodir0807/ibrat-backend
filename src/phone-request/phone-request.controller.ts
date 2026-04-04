import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PhoneRequestService } from './phone-request.service';
import { CreatePhoneRequestDto } from './dto/create-phone-request.dto';
import { HandlePhoneRequestDto } from './dto/handle-phone-request.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { PhoneRequestListQueryDto } from './dto/phone-request-list-query.dto';

@Controller('phone-request')
export class PhoneRequestController {
  constructor(private readonly service: PhoneRequestService) {}

  @Public()
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreatePhoneRequestDto) {
    return this.service.create(dto);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  handle(@Body() dto: HandlePhoneRequestDto) {
    return this.service.handle(dto);
  }

  @Public()
  @Get()
  getById(@Query('telegramId') telegramId: string) {
    return this.service.getByTelegramId(telegramId);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getPending(@Query() query: PhoneRequestListQueryDto) {
    return this.service.getPending(query);
  }

  @Public()
  @Post('tg-request')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  createFromTelegram(@Body() body: CreatePhoneRequestDto) {
    return this.service.create(body);
  }

  @Public()
  @Get('tg-check')
  checkFromTelegram(@Query('telegramId') telegramId: string) {
    return this.service.getByTelegramId(telegramId);
  }
}
