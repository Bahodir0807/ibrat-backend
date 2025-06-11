import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course extends Document {
  @Prop({ required: true }) title: string;
  @Prop() description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', }) teacher: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Schedule' }], default: [] })
  schedule: Types.ObjectId[];
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Student' }], default: [] })
  students: Types.ObjectId[];
}
export const CourseSchema = SchemaFactory.createForClass(Course);
