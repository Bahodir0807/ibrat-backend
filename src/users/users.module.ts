import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Schedule, ScheduleSchema } from '../schedule/schemas/schedule.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Homework, HomeworkSchema } from '../homework/schemas/homework.schema';
import { Grade, GradeSchema } from '../grades/schemas/grade.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: Course.name, schema: CourseSchema },
    { name: Group.name, schema: GroupSchema },
    { name: Schedule.name, schema: ScheduleSchema },
    { name: Payment.name, schema: PaymentSchema },
    { name: Attendance.name, schema: AttendanceSchema },
    { name: Homework.name, schema: HomeworkSchema },
    { name: Grade.name, schema: GradeSchema },
  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
