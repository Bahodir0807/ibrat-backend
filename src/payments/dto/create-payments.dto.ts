import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  student: string;

  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
