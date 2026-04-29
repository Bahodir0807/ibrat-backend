import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

export class StatisticsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  type?: string;
}
