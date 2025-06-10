import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { CoursesModule } from '../courses/courses.module';
import { TeachersModule } from '../teachers/teachers.module';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';
import { RoomModule } from '../rooms/room.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    CoursesModule,
    TeachersModule,
    RoomModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
