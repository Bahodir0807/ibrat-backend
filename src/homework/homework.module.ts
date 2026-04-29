import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Homework, HomeworkSchema } from './schemas/homework.schema';
import { HomeworkService } from './homework.service';
import { HomeworkController } from './homework.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Schedule, ScheduleSchema } from '../schedule/schemas/schedule.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Homework.name, schema: HomeworkSchema },
    { name: User.name, schema: UserSchema },
    { name: Course.name, schema: CourseSchema },
    { name: Group.name, schema: GroupSchema },
    { name: Schedule.name, schema: ScheduleSchema },
  ])],
  providers: [HomeworkService],
  controllers: [HomeworkController],
  exports: [HomeworkService],
})
export class HomeworkModule {}
