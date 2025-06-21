import { IsOptional, IsNumber } from 'class-validator';

export class UpdateGradeDto {
  @IsOptional()
  @IsNumber()
  score?: number;
}