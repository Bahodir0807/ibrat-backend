import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BranchDocument = Branch & Document;

@Schema({ timestamps: true })
export class Branch {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ trim: true })
  status?: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
BranchSchema.index({ name: 1 });
BranchSchema.index({ isActive: 1 });
