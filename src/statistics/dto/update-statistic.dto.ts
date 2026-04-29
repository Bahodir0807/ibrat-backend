import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional } from 'class-validator';

export class UpdateStatisticDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  readonly value?: number;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
