import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { FinancialTransaction, FinancialTransactionSchema } from './schemas/financial-transaction.schema';
import { FinancialTransactionsRepository } from './financial-transactions.repository';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Payment.name, schema: PaymentSchema },
    { name: FinancialTransaction.name, schema: FinancialTransactionSchema },
    { name: Course.name, schema: CourseSchema },
    { name: User.name, schema: UserSchema },
  ])],
  providers: [PaymentsService, PaymentsRepository, FinancialTransactionsRepository],
  controllers: [PaymentsController],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
