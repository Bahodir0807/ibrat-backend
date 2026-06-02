import { IsIn, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentReportsSummaryQueryDto {
  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsIn(['pending', 'partial', 'paid', 'debt', 'frozen', 'overpaid'])
  status?: 'pending' | 'partial' | 'paid' | 'debt' | 'frozen' | 'overpaid';
}
