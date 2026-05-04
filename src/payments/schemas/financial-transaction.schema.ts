import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { FinancialTransactionType } from '../financial-transaction-type.enum';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class FinancialTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', index: true })
  paymentId?: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ enum: FinancialTransactionType, required: true, index: true })
  type: FinancialTransactionType;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;

  createdAt: Date;
}

export type FinancialTransactionDocument = HydratedDocument<FinancialTransaction>;
export const FinancialTransactionSchema = SchemaFactory.createForClass(FinancialTransaction);
FinancialTransactionSchema.index(
  { paymentId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      paymentId: { $exists: true },
      type: {
        $in: [
          FinancialTransactionType.PaymentCreated,
          FinancialTransactionType.PaymentConfirmed,
          FinancialTransactionType.PaymentCancelled,
        ],
      },
    },
  },
);
