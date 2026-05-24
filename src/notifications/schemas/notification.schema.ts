import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type NotificationDocument = Notification & Document;
export type NotificationRecipientType = 'student' | 'admin';
export type NotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

@Schema()
export class Notification {
  @Prop()
  type?: string;

  @Prop({ enum: ['student', 'admin'] })
  recipientType?: NotificationRecipientType;

  @Prop()
  studentId?: string;

  @Prop()
  paymentId?: string;

  @Prop()
  recipientTelegramId?: string;

  @Prop()
  chatId?: string;

  @Prop({ type: SchemaTypes.Mixed })
  payload?: Record<string, unknown>;

  @Prop({ enum: ['sent', 'failed', 'skipped'] })
  status?: NotificationDeliveryStatus;

  @Prop()
  errorMessage?: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  userId: string;

  @Prop()
  title: string;

  @Prop()
  message: string;

  @Prop({ required: true, default: false })
  isRead: boolean;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
