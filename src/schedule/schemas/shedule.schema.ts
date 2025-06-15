import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Course } from 'src/courses/schemas/course.schema';
import { Room } from 'src/rooms/schemas/room.schema';
import { User } from 'src/users/schemas/user.schema';

export type ScheduleDocument = Schedule & Document;

@Schema()
export class Schedule {
  @Prop({ required: true, type: Types.ObjectId, ref: Course.name })
  course: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: Room.name })
  room: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  timeStart: Date;

  @Prop({ required: true })
  timeEnd: Date;

  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  teacher: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: User.name, default: [] })
  students: Types.ObjectId[];
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
