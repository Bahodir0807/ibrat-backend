import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Request,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly svc: ScheduleService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  create(@Body() dto: CreateScheduleDto) {
    return this.svc.create(dto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  findAll() {
    return this.svc.findAll();
  }

  @Get('me')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student)
  async getMySchedule(@Request() req) {
    return this.svc.getScheduleForUser(req.user.userId, req.user.role);
  }

  @Get('user/:id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  async getScheduleForUser(@Param('id') id: string, @Request() req) {
    return this.svc.getScheduleForUser(id, req.user.role);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  update(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
