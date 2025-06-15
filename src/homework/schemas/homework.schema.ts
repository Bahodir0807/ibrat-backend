import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HomeworkDocument = Homework & Document;

@Schema()
export class Homework {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true })
  courseId: string;

  @Prop({ type: [String] })
  files?: string[];
}

export const HomeworkSchema = SchemaFactory.createForClass(Homework);
