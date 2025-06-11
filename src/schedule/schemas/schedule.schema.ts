import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Schedule extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true }) course: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true }) teacher: Types.ObjectId;

  @Prop({ required: true }) title: string;
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true }) room: Types.ObjectId;
  @Prop({ required: true }) startTime: Date;
  @Prop({ required: true }) endTime: Date;
  @Prop() description?: string;
}

export type ScheduleDocument = Schedule & Document;
export const ScheduleSchema = SchemaFactory.createForClass(Schedule);
