import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PaymentStatus } from '../payment-status.enum';

export interface PaymentHistoryEntry {
  amount: number;
  paidAt: Date;
  paymentMethod: 'cash' | 'card' | 'transfer';
  comment?: string;
  createdBy: Types.ObjectId;
}

@Schema({ _id: false })
export class PaymentHistory implements PaymentHistoryEntry {
  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: () => new Date() })
  paidAt: Date;

  @Prop({ enum: ['cash', 'card', 'transfer'], required: true })
  paymentMethod: 'cash' | 'card' | 'transfer';

  @Prop()
  comment?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branchId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 12, index: true })
  month: number;

  @Prop({ required: true, min: 2000, max: 2100, index: true })
  year: number;

  @Prop({ required: true, index: true }) // e.g. "2026-05"
  paymentPeriod: string;

  @Prop({ required: true, min: 0 })
  expectedAmount: number;

  @Prop({ required: true, default: 0, min: 0 })
  paidAmount: number;

  @Prop({ required: true, default: 0, min: 0 })
  remainingAmount: number;

  @Prop({ required: true, default: 0, min: 0 })
  overpaidAmount: number;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.Pending, index: true })
  status: PaymentStatus;

  @Prop({ default: false })
  isFrozen: boolean;

  @Prop()
  freezeReason?: string;

  @Prop()
  freezeFrom?: Date;

  @Prop()
  freezeTo?: Date;

  @Prop()
  comment?: string;

  @Prop({ type: [PaymentHistory], default: [] })
  paymentHistory: PaymentHistory[];
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Indexes
PaymentSchema.index({ studentId: 1, courseId: 1, year: 1, month: 1 }, { unique: true });
PaymentSchema.index({ studentId: 1, status: 1 });
PaymentSchema.index({ courseId: 1, status: 1 });
PaymentSchema.index({ groupId: 1, status: 1 });
PaymentSchema.index({ branchId: 1, status: 1 });
PaymentSchema.index({ paymentPeriod: 1 });
PaymentSchema.index({ status: 1, isFrozen: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ createdAt: -1 });
