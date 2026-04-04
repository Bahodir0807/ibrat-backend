import { IsIn, IsMongoId, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class PaymentsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsMongoId()
  courseId?: string;

  @IsOptional()
  @IsIn(['confirmed', 'pending'])
  status?: 'confirmed' | 'pending';
}
