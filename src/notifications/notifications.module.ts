import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { StudentsModule } from '../students/students.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  NotificationDelivery,
  NotificationDeliverySchema,
} from './schemas/notification-delivery.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { SmsService } from './sms/sms.service';
import { SmsTemplateService } from './sms/sms-template.service';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider.interface';
import { DebtRemindersService } from './debt-reminders.service';

@Module({
  imports: [
    UsersModule,
    StudentsModule,
    forwardRef(() => PaymentsModule),
    forwardRef(() => TelegramModule),
    MongooseModule.forFeature([
      { name: NotificationDelivery.name, schema: NotificationDeliverySchema },
      { name: Student.name, schema: StudentSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDeliveryRepository,
    NotificationDeliveriesService,
    SmsService,
    SmsTemplateService,
    MockSmsProvider,
    DebtRemindersService,
    { provide: SMS_PROVIDER, useExisting: MockSmsProvider },
  ],
  exports: [
    NotificationsService,
    NotificationDeliveriesService,
    DebtRemindersService,
    SmsService,
  ],
})
export class NotificationsModule {}
