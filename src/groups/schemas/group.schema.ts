import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema()
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  course: string;

  @Prop({ required: true })
  teacher: string;

  @Prop({ type: [String] })
  students: string[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
