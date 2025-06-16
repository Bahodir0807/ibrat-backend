import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('user/:userId')
  async getByUser(@Param('userId') userId: string) {
    return this.attendanceService.getByUser(userId);
  }

  @Post()
  async markAttendance(
    @Body() body: { userId: string; date: string; status: 'present' | 'absent' },
  ) {
    return this.attendanceService.mark(body.userId, body.date, body.status);
  }
}
