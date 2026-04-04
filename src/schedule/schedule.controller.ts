import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { ScheduleListQueryDto } from './dto/schedule-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(
    private readonly svc: ScheduleService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async ensureTeacherOwnsSchedule(scheduleId: string, teacherId: string) {
    const schedule = await this.svc.findDocumentById(scheduleId);

    if (!schedule) {
      throw new ForbiddenException('Schedule not found or access denied');
    }

    if (String(schedule.teacher ?? '') !== teacherId) {
      throw new ForbiddenException('Teachers can manage only their own schedule');
    }
  }

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreateScheduleDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      if (dto.teacher && dto.teacher !== req.user.userId) {
        throw new ForbiddenException('Teachers can create schedule only for themselves');
      }

      dto.teacher = req.user.userId;
    }

    return this.svc.create(dto).then(schedule => {
      this.auditLogService.log({
        action: 'schedule.create',
        actor: { id: req.user.userId, role: req.user.role },
        target: { type: 'schedule', id: schedule.id },
        status: 'success',
      });
      return schedule;
    });
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() query: ScheduleListQueryDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      return this.svc.findAll({ ...query, teacherId: req.user.userId });
    }

    return this.svc.findAll(query);
  }

  @Get('me')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async getMySchedule(@Request() req) {
    return this.svc.getScheduleForUser(req.user.userId, req.user.role);
  }

  @Get('user/:id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async getScheduleForUser(@Param('id') id: string, @Request() req) {
    if (req.user.role === Role.Teacher && req.user.userId !== id) {
      throw new ForbiddenException('Teachers can access only their own schedule');
    }

    if ([Role.Admin, Role.Owner, Role.Extra].includes(req.user.role)) {
      return this.svc.getScheduleByUserId(id);
    }

    return this.svc.getScheduleForUser(id, req.user.role);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param('id') id: string, @Request() req) {
    const schedule = await this.svc.findOne(id);

    if (req.user.role === Role.Teacher && String(schedule.teacher?.id ?? schedule.teacher ?? '') !== req.user.userId) {
      throw new ForbiddenException('Teachers can access only their own schedule');
    }

    if (req.user.role === Role.Student) {
      const students = Array.isArray(schedule.students) ? schedule.students : [];
      const isParticipant = students.some(student => String(student?.id ?? student ?? '') === req.user.userId);
      if (!isParticipant) {
        throw new ForbiddenException('Students can access only their own schedule');
      }
    }

    return schedule;
  }

  @Put(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateScheduleDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      await this.ensureTeacherOwnsSchedule(id, req.user.userId);

      if (dto.teacher && dto.teacher !== req.user.userId) {
        throw new ForbiddenException('Teachers cannot reassign schedule to another teacher');
      }

      dto.teacher = req.user.userId;
    }

    const schedule = await this.svc.update(id, dto);
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
  async remove(@Param('id') id: string, @Request() req) {
    await this.svc.remove(id);
    this.auditLogService.log({
      action: 'schedule.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'schedule', id },
      status: 'success',
    });
    return { success: true, message: 'Schedule deleted successfully' };
  }
}
