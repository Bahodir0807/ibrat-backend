import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Room extends Document {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description?: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
export type RoomDocument = Room & Document;