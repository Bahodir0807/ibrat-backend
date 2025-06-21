import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AttendanceService } from './attendance.service';
import { Controller, Get, Param, Post, Body } from '@nestjs/common';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param('userId') userId: string) {
    return this.attendanceService.getByUser(userId);
  }

  @Post()
  @Roles(Role.Teacher, Role.Admin, Role.Owner)
  async markAttendance(
    @Body() body: { userId: string; date: string; status: 'present' | 'absent' },
  ) {
    return this.attendanceService.markAttendance(body);
  }
}
