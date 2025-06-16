import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GradeDocument = Grade & Document;

@Schema()
export class Grade {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  score: number;

  @Prop({ default: null })
  date: Date;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);