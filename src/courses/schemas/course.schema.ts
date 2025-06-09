import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Course extends Document {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  teacherId?: string;
}

export type CourseDocument = Course & Document;
export const CourseSchema = SchemaFactory.createForClass(Course);