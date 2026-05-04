import { IsDateString, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  student: string;

  @IsMongoId()
  courseId: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;
}
