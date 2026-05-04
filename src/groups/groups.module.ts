import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupsRepository } from './groups.repository';
import { Group, GroupSchema } from './schemas/group.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Schedule, ScheduleSchema } from '../schedule/schemas/schedule.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Group.name, schema: GroupSchema },
    { name: Course.name, schema: CourseSchema },
    { name: User.name, schema: UserSchema },
    { name: Schedule.name, schema: ScheduleSchema },
  ])],
  controllers: [GroupsController],
  providers: [GroupsService, GroupsRepository],
  exports: [GroupsService, GroupsRepository],
})
export class GroupsModule {}
