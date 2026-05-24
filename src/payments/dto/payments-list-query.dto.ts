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
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsIn(['pending', 'partial', 'paid', 'debt', 'frozen', 'overpaid'])
  status?: 'pending' | 'partial' | 'paid' | 'debt' | 'frozen' | 'overpaid';
}
