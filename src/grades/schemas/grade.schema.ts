import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';

export type GradeDocument = Grade & Document;

@Schema()
export class Grade {
  @Prop({ type: Types.ObjectId, ref: Student.name, required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  score: number;

  @Prop({ default: null })
  date: Date;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);
GradeSchema.index({ user: 1, date: -1 });
GradeSchema.index({ user: 1, subject: 1 });
