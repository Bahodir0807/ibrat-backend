import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../roles/roles.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true }) 
export class User {
  @Prop({ required: true, unique: true })
  username: string;
  
  @Prop({ unique: true, sparse: true })
  telegramId?: string;
  
  @Prop({ unique: true, sparse: true })
  email?: string;
  
  @Prop({ required: true }) 
  password: string;
  
  @Prop()
  firstName?: string;
  
  @Prop()
  lastName?: string;
  
  @Prop({ enum: Role, default: Role.Student }) 
  role: Role;
  
  @Prop()
  phoneNumber?: string;
  
  @Prop({ default: false })
  isActive: boolean;
  
  @Prop()
  avatarUrl?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
