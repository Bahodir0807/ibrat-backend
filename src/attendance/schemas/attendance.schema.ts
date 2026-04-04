import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Types } from 'mongoose';

export type AttendanceDocument = Attendance & Document;

@Schema()
export class Attendance {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, enum: ['present', 'absent', 'late', 'excused'] })
  status: 'present' | 'absent' | 'late' | 'excused';
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
