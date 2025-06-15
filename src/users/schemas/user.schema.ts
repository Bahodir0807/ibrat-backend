import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../roles/roles.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true }) 
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: false, unique: true })
  email: string;

  @Prop({ required: false })
  password: string;

  @Prop({ required: false })
  firstName: string;

  @Prop({ required: false })
  lastName: string;

  @Prop({ required: false, enum: Role })
  role: Role;

  @Prop({ required: false })
  phoneNumber: string;

  @Prop({ default: false })
  isActive: boolean;

  @Prop()
  avatarUrl?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
