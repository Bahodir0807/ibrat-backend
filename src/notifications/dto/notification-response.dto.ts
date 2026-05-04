import { NotificationType } from '../notification-type.enum';

export type NotificationResponseDto = {
  sentTo?: string | number;
  type?: NotificationType;
  success?: boolean;
  reason?: string;
};

export function mapNotificationResponse(value: NotificationResponseDto): NotificationResponseDto {
  return {
    sentTo: value.sentTo,
    type: value.type,
    success: value.success,
    reason: value.reason,
  };
}
