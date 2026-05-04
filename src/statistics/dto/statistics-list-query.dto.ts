import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class StatisticsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
