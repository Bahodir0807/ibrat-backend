import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentsSchedulerService } from './payments-scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PaymentsModule,
    NotificationsModule,
  ],
  providers: [PaymentsSchedulerService],
  exports: [PaymentsSchedulerService],
})
export class JobsSchedulerModule {}
