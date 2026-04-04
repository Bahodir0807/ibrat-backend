import { IsEnum, IsMongoId, IsString } from 'class-validator';
import { NotificationType } from '../notification-type.enum';

export class CreateNotificationDto {
  @IsMongoId()
  userId: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;
}
