import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';

export type HomeworkDocument = Homework & Document;

@Schema()
export class Homework {
  @Prop({ type: Types.ObjectId, ref: Student.name, required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  tasks: string[];

  @Prop({ default: false })
  completed: boolean;
}

export const HomeworkSchema = SchemaFactory.createForClass(Homework);
HomeworkSchema.index({ user: 1, date: -1 });
HomeworkSchema.index({ user: 1, completed: 1 });
HomeworkSchema.index({ createdAt: -1 });
HomeworkSchema.set('timestamps', true);
HomeworkSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});
