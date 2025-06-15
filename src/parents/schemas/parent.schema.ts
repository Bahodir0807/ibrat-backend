import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ParentDocument = Parent & Document;

@Schema()
export class Parent {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: [String] })
  children: string[];
}

export const ParentSchema = SchemaFactory.createForClass(Parent);
