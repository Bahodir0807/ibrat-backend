import { IsDateString, IsIn, IsMongoId } from 'class-validator';

export class MarkAttendanceDto {
  @IsMongoId()
  userId: string;

  @IsDateString()
  date: string;

  @IsIn(['present', 'absent', 'late', 'excused'])
  status: 'present' | 'absent' | 'late' | 'excused';
}
