import { IsDateString, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateStatisticDto {
  @IsDateString()
  readonly date: string;

  @IsString()
  @IsNotEmpty()
  readonly type: string;

  @IsNumber()
  readonly value: number;

  @IsOptional()
  @IsObject()
  readonly metadata?: Record<string, unknown>;
}
