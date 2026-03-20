import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class CreateScheduleDto {
  @IsMongoId()
  course: string;

  @IsMongoId()
  room: string;

  @IsDateString()
  date: string;

  @IsDateString()
  timeStart: string;

  @IsDateString()
  timeEnd: string;

  @IsMongoId()
  teacher: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @Type(() => String)
  students?: string[];

  @IsOptional()
  @IsMongoId()
  group?: string;
}
