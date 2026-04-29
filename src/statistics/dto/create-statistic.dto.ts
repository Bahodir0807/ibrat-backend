import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateStatisticDto {
  @IsDateString()
  readonly date: string;

  @IsString()
  @IsNotEmpty()
  readonly type: string;

  @Type(() => Number)
  @IsNumber()
  readonly value: number;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
