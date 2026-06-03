import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export class CreateScheduleDto {
  @IsMongoId()
  course: string;

  @IsMongoId()
  room: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeStart: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  timeEnd: string;

  @IsMongoId()
  teacher: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNotEmpty({ each: true })
  @IsIn(WEEKDAYS, { each: true })
  @Type(() => String)
  weekdays: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @Type(() => String)
  students?: string[];

  @IsOptional()
  @IsMongoId()
  group?: string;
}
