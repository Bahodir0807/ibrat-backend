import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Course } from '../../courses/schemas/course.schema';
import { Room } from '../../rooms/schemas/room.schema';
import { User } from '../../users/schemas/user.schema';
import { Group } from '../../groups/schemas/group.schema';
import { Student } from '../../students/schemas/student.schema';

export type ScheduleDocument = Schedule & Document;

@Schema({ timestamps: true })
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

  @Prop({ type: [Types.ObjectId], ref: Student.name, default: [] })
  students: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: Group.name })
  group: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  teacher: Types.ObjectId;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
ScheduleSchema.index({ teacher: 1, date: 1 });
ScheduleSchema.index({ students: 1, date: 1 });
ScheduleSchema.index({ group: 1, date: 1 });
ScheduleSchema.index({ room: 1, date: 1, timeStart: 1, timeEnd: 1 });
ScheduleSchema.index({ course: 1, date: 1 });
ScheduleSchema.index({ createdAt: -1 });
