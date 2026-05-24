import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import {
  FinancialTransaction,
  FinancialTransactionSchema,
} from './schemas/financial-transaction.schema';
import { FinancialTransactionsRepository } from './financial-transactions.repository';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import {
  Notification,
  NotificationSchema,
} from '../notifications/schemas/notification.schema';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    TelegramModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: FinancialTransaction.name, schema: FinancialTransactionSchema },
      { name: Course.name, schema: CourseSchema },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [
    PaymentsService,
    PaymentsRepository,
    FinancialTransactionsRepository,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
