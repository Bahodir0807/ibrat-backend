import { IsDateString, IsIn, IsMongoId, IsOptional } from 'class-validator';

export class MarkAttendanceDto {
  @IsMongoId()
  userId: string;

  @IsOptional()
  @IsMongoId()
  scheduleId?: string;

  @IsDateString()
  date: string;

  @IsIn(['present', 'absent', 'late', 'excused'])
  status: 'present' | 'absent' | 'late' | 'excused';
}
