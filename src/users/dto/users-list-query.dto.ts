import { IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Role } from '../../roles/roles.enum';

export class UsersListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
