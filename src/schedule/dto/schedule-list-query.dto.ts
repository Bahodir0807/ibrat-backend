import { IsDateString, IsMongoId, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class ScheduleListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
