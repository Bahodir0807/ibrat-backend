import { Types } from 'mongoose';
import {
  NotificationDeliveryChannel,
  NotificationDeliveryRecipientType,
  NotificationDeliveryStatus,
  NotificationDeliveryType,
} from '../schemas/notification-delivery.schema';

export type NotificationDeliveryResponseDto = {
  id: string;
  type: NotificationDeliveryType;
  channel: NotificationDeliveryChannel;
  paymentId: string;
  studentId: string;
  studentName?: string;
  studentNumber?: string;
  recipientType: NotificationDeliveryRecipientType;
  phone: string;
  message: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  error?: string;
  dateKey: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  sentAt?: string;
};

export type NotificationDeliveryAggregationRow = {
  _id: Types.ObjectId | string;
  type: NotificationDeliveryType;
  channel: NotificationDeliveryChannel;
  paymentId: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  studentName?: string;
  studentNumber?: string;
  recipientType: NotificationDeliveryRecipientType;
  phone: string;
  message: string;
  status: NotificationDeliveryStatus;
  providerMessageId?: string;
  error?: string;
  dateKey: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date | string;
  sentAt?: Date | string;
};

export function mapNotificationDeliveryResponse(
  row: NotificationDeliveryAggregationRow,
): NotificationDeliveryResponseDto {
  return {
    id: String(row._id),
    type: row.type,
    channel: row.channel,
    paymentId: String(row.paymentId),
    studentId: String(row.studentId),
    studentName: row.studentName,
    studentNumber: row.studentNumber,
    recipientType: row.recipientType,
    phone: row.phone,
    message: row.message,
    status: row.status,
    providerMessageId: row.providerMessageId,
    error: row.error,
    dateKey: row.dateKey,
    metadata: row.metadata,
    createdAt: row.createdAt
      ? new Date(row.createdAt).toISOString()
      : undefined,
    sentAt: row.sentAt ? new Date(row.sentAt).toISOString() : undefined,
  };
}
