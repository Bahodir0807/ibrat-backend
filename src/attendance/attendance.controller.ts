import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  @Roles(Role.Student, Role.Teacher, Role.Admin, Role.Owner)
  async getMyAttendance(@Request() req) {
    return this.attendanceService.getByUser(req.user.userId);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param('userId') userId: string, @Request() req) {
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own attendance');
    }

    return this.attendanceService.getByUser(userId);
  }

  @Post()
  @Roles(Role.Teacher, Role.Admin, Role.Owner)
  async markAttendance(@Body() body: MarkAttendanceDto, @Request() req) {
    const attendance = await this.attendanceService.markAttendance(body);
    this.auditLogService.log({
      action: 'attendance.mark',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'attendance', id: attendance.id },
      status: 'success',
      metadata: { userId: body.userId, status: body.status },
    });
    return attendance;
  }
}
