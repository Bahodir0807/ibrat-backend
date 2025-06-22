import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { PhoneRequestModule } from '../phone-request/phone-request.module';
import { HomeworkModule } from '../homework/homework.module';
import { GradesModule } from '../grades/grades.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { SchedulesModule } from '../schedule/schedule.module';

@Module({
  imports: [
    GradesModule,
    AttendanceModule,
    PhoneRequestModule,
    UsersModule,
    HomeworkModule,
    SchedulesModule,
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}

