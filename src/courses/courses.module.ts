import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { CoursesRepository } from './courses.repository';
import { Course, CourseSchema } from './schemas/course.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Schedule, ScheduleSchema } from '../schedule/schemas/schedule.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository],
  exports: [CoursesService, CoursesRepository],
})
export class CoursesModule {}
