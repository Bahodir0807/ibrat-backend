import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Course extends Document {
  @Prop({ required: true }) title: string;
  @Prop() description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Teacher', required: true }) teacher: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Schedule' }], default: [] })
  schedule: Types.ObjectId[];
}
export const CourseSchema = SchemaFactory.createForClass(Course);
