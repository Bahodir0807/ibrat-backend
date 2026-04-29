import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Types } from 'mongoose';
import { Schedule } from '../../schedule/schemas/schedule.schema';

export type AttendanceDocument = Attendance & Document;

@Schema()
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Schedule.name, required: true })
  schedule: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, enum: ['present', 'absent', 'late', 'excused'] })
  status: 'present' | 'absent' | 'late' | 'excused';
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
AttendanceSchema.index({ user: 1, schedule: 1 }, { unique: true });
