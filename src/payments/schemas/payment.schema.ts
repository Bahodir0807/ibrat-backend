import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentStatus } from '../payment-status.enum';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  student: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
  course: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop()
  paidAt: Date;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.Pending, index: true })
  status: PaymentStatus;

  @Prop({ default: false })
  isConfirmed: boolean;

  @Prop()
  confirmedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  deletedAt?: Date;

  @Prop()
  method?: string;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ student: 1, course: 1 }, { unique: true });
