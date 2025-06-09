import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Student extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  phone?: string;

  @Prop()
  group?: string;

  @Prop()
  courseId?: string;

  @Prop()
  teacherId?: string;
}

export type StudentDocument = Student & Document;
export const StudentSchema = SchemaFactory.createForClass(Student);