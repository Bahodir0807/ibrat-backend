import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PhoneRequestDocument = PhoneRequest & Document;

@Schema()
export class PhoneRequest {
  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  telegramId: string;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: null })
  updatedAt: Date;
  _id: string;
}

export const PhoneRequestSchema = SchemaFactory.createForClass(PhoneRequest);
