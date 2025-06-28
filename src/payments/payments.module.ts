import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema },
    { name: Course.name, schema: CourseSchema },
  ])],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
