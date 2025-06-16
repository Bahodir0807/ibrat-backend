import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateGradeDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  subject: string;

  @IsNotEmpty()
  @IsNumber()
  score: number;
}