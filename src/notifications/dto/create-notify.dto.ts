import { IsString, IsEnum } from 'class-validator';
import { NotificationType } from '../notification-type.enum';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;
}
