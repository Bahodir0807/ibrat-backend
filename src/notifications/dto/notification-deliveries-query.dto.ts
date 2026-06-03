import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import {
  NotificationDeliveryChannel,
  NotificationDeliveryRecipientType,
  NotificationDeliveryStatus,
  NotificationDeliveryType,
} from '../schemas/notification-delivery.schema';

export class NotificationDeliveriesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['debt_sms'])
  type?: NotificationDeliveryType;

  @IsOptional()
  @IsIn(['sms'])
  channel?: NotificationDeliveryChannel;

  @IsOptional()
  @IsIn(['skipped', 'pending', 'sent', 'failed', 'dry_run'])
  status?: NotificationDeliveryStatus;

  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsMongoId()
  paymentId?: string;

  @IsOptional()
  @IsIn(['student', 'parent'])
  recipientType?: NotificationDeliveryRecipientType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
}
