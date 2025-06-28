import { IsMongoId, IsArray, ArrayNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  student: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  courseIds: string[];

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
