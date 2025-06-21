import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schedule, ScheduleSchema } from './schemas/shedule.schema';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Course.name, schema: CourseSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class SchedulesModule {}
