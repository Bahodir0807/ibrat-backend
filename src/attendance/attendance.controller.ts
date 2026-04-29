import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UserIdParamDto } from '../common/dto/user-id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  @Roles(Role.Student)
  async getMyAttendance(@Request() req) {
    return this.attendanceService.getByUserForActor(
      req.user.userId,
      req.user as AuthenticatedUser,
    );
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param() params: UserIdParamDto, @Request() req) {
    const { userId } = params;
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own attendance');
    }

    return this.attendanceService.getByUserForActor(userId, req.user as AuthenticatedUser);
  }

  @Post()
  @Roles(Role.Teacher, Role.Admin, Role.Owner)
  async markAttendance(@Body() body: MarkAttendanceDto, @Request() req) {
    const attendance = await this.attendanceService.markAttendance(body, {
      userId: req.user.userId,
      role: req.user.role,
      branchIds: req.user.branchIds,
    });
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
