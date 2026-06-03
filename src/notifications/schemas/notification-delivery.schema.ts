import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type NotificationDeliveryDocument =
  HydratedDocument<NotificationDelivery>;

export type NotificationDeliveryType = 'debt_sms';
export type NotificationDeliveryChannel = 'sms';
export type NotificationDeliveryRecipientType = 'student' | 'parent';
export type NotificationDeliveryStatus =
  | 'skipped'
  | 'pending'
  | 'sent'
  | 'failed'
  | 'dry_run';

@Schema({ timestamps: true })
export class NotificationDelivery {
  @Prop({ required: true, enum: ['debt_sms'], index: true })
  type: NotificationDeliveryType;

  @Prop({ required: true, enum: ['sms'], index: true })
  channel: NotificationDeliveryChannel;

  @Prop({ type: Types.ObjectId, ref: 'Payment', required: true, index: true })
  paymentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  studentId: Types.ObjectId;

  @Prop({ required: true, enum: ['student', 'parent'] })
  recipientType: NotificationDeliveryRecipientType;

  @Prop({ required: true, index: true })
  phone: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    required: true,
    enum: ['skipped', 'pending', 'sent', 'failed', 'dry_run'],
    index: true,
  })
  status: NotificationDeliveryStatus;

  @Prop()
  providerMessageId?: string;

  @Prop({ type: SchemaTypes.Mixed })
  providerResponse?: Record<string, unknown>;

  @Prop()
  error?: string;

  @Prop()
  sentAt?: Date;

  @Prop({ required: true, index: true })
  dateKey: string;

  @Prop({ type: SchemaTypes.Mixed })
  metadata?: Record<string, unknown>;
}

export const NotificationDeliverySchema =
  SchemaFactory.createForClass(NotificationDelivery);

NotificationDeliverySchema.index({
  paymentId: 1,
  phone: 1,
  dateKey: 1,
  status: 1,
});
NotificationDeliverySchema.index({ type: 1, channel: 1, createdAt: -1 });
NotificationDeliverySchema.index({ status: 1, createdAt: -1 });
NotificationDeliverySchema.index({ studentId: 1, createdAt: -1 });
NotificationDeliverySchema.index({ 'metadata.branchId': 1, createdAt: -1 });
NotificationDeliverySchema.index({ 'metadata.courseId': 1, createdAt: -1 });
