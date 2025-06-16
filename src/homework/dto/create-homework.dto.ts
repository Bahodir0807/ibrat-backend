import { IsNotEmpty, IsArray, ArrayNotEmpty, IsDateString, IsString } from 'class-validator';

export class CreateHomeworkDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tasks: string[];
}
