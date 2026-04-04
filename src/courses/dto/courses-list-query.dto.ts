import { IsMongoId, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class CoursesListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  @IsOptional()
  @IsMongoId()
  studentId?: string;
}
