import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Course } from '../../courses/schemas/course.schema';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, type: Types.ObjectId, ref: Course.name })
  course: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: User.name })
  teacher: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: Student.name, default: [] })
  students: Types.ObjectId[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ course: 1 });
GroupSchema.index({ teacher: 1 });
GroupSchema.index({ students: 1 });
GroupSchema.index({ createdAt: -1 });
