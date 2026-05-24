import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  @IsNotEmpty()
  studentId: string;

  @IsMongoId()
  @IsNotEmpty()
  courseId: string;

  @IsMongoId()
  @IsNotEmpty()
  groupId: string;

  @IsMongoId()
  @IsNotEmpty()
  branchId: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  @IsNotEmpty()
  month: number;

  @IsNumber()
  @Min(2000)
  @Max(2100)
  @IsNotEmpty()
  year: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  expectedAmount: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  paidAmount: number;

  @IsOptional()
  @IsEnum(['cash', 'card', 'transfer'])
  paymentMethod?: 'cash' | 'card' | 'transfer';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
