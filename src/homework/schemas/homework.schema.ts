import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HomeworkDocument = Homework & Document;

@Schema()
export class Homework {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  tasks: string[];

  @Prop({ default: false })
  completed: boolean;
}

export const HomeworkSchema = SchemaFactory.createForClass(Homework);
HomeworkSchema.set('timestamps', true);
HomeworkSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});
