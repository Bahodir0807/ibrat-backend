import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { ScheduleListQueryDto } from './dto/schedule-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';

@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly svc: ScheduleService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async create(@Body() dto: CreateScheduleDto, @Request() req) {
    const schedule = await this.svc.createForActor(dto, req.user);
    this.auditLogService.log({
      action: 'schedule.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'schedule', id: schedule.id },
      status: 'success',
    });
    return schedule;
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  findAll(@Query() query: ScheduleListQueryDto, @Request() req) {
    return this.svc.findAllForActor(query, req.user);
  }

  @Get('me')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async getMySchedule(@Request() req) {
    return this.svc.getScheduleByUserIdForActor(req.user.userId, req.user);
  }

  @Get('user/:id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async getScheduleForUser(@Param() params: IdParamDto, @Request() req) {
    return this.svc.getScheduleByUserIdForActor(params.id, req.user);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param() params: IdParamDto, @Request() req) {
    return this.svc.findOneForActor(params.id, req.user);
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async update(@Param() params: IdParamDto, @Body() dto: UpdateScheduleDto, @Request() req) {
    const { id } = params;
    const schedule = await this.svc.updateForActor(id, dto, req.user);
    this.auditLogService.log({
      action: 'schedule.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'schedule', id },
      status: 'success',
    });
    return schedule;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    await this.svc.removeForActor(id, req.user);
    this.auditLogService.log({
      action: 'schedule.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'schedule', id },
      status: 'success',
    });
    return { message: 'Schedule deleted successfully' };
  }
}
