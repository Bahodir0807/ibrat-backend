import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

export enum RoomType {
  CLASSROOM = 'classroom',
  LAB = 'lab',
  OFFICE = 'office',
  MEETING = 'meeting',
}

@Schema()
export class Room {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  capacity: number;

  @Prop({ required: true, enum: RoomType })
  type: RoomType;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop()
  description?: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
