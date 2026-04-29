import { ArrayNotEmpty, IsArray, IsDateString, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateHomeworkDto {
  @IsNotEmpty()
  @IsMongoId()
  userId: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tasks: string[];
}
