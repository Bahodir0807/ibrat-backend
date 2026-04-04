import { IsIn, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class PhoneRequestListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';
}
