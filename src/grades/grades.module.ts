import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Grade, GradeSchema } from './schemas/grade.schema';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { Schedule, ScheduleSchema } from '../schedule/schemas/schedule.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Grade.name, schema: GradeSchema },
    { name: User.name, schema: UserSchema },
    { name: Course.name, schema: CourseSchema },
    { name: Group.name, schema: GroupSchema },
    { name: Schedule.name, schema: ScheduleSchema },
  ])],
  providers: [GradesService],
  controllers: [GradesController],
  exports: [GradesService],
})
export class GradesModule {}
