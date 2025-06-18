import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { PhoneRequestModule } from '../phone-request/phone-request.module';
import { HomeworkModule } from '../homework/homework.module';
import { GradesModule } from '../grades/grades.module';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    GradesModule,
    AttendanceModule,
    PhoneRequestModule,
    UsersModule,
    HomeworkModule,
    TelegrafModule.forRootAsync({
      useFactory: (cs: ConfigService) => {
        const token = cs.get<string>('TELEGRAM_BOT_TOKEN');
        if (!token) throw new Error('TELEGRAM_BOT_TOKEN env var is required');
        return { token };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
