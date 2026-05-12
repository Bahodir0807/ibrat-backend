import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';

export type UserDocument = User & Document & { _id: string; };

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  username!: string;
  
  @Prop({ unique: true, sparse: true })
  telegramId?: string;
  
  @Prop({ unique: true, sparse: true })
  email?: string;
  
  @Prop({ required: true }) 
  password!: string;
  
  @Prop({ default: '' })
  firstName!: string;
  
  @Prop({ default: '' })
  lastName!: string;
  
  @Prop({ enum: Role, default: Role.Student }) 
  role!: Role;
  
  @Prop()
  phoneNumber?: string;
  
  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  @Prop()
  passwordChangedAt?: Date;
  
  @Prop()
  avatarUrl?: string;

  @Prop({ type: [String], default: [] })
  branchIds!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ branchIds: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ role: 1, branchIds: 1 });
UserSchema.index({ createdAt: -1 });
