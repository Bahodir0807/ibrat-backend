import { Transform } from 'class-transformer';
import { IsEnum, IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NotificationType } from '../notification-type.enum';

export class CreateNotificationDto {
  @IsMongoId()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MaxLength(1000)
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;
}
