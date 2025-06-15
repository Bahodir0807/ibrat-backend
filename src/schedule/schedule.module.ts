import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { CoursesModule } from '../courses/courses.module';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';
import { RoomModule } from '../rooms/room.module';
import { Schedule, ScheduleSchema } from './schemas/shedule.schema';
import { Course, CourseSchema } from 'src/courses/schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
    CoursesModule,
    RoomModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class SchedulesModule {}
