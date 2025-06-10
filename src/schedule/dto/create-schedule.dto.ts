import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  title: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsString()
  courseId: string;

  @IsString()
  teacherId: string;

  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  description?: string;
}
