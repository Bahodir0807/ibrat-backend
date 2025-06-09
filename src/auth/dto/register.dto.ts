import { IsString, IsEnum } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsEnum(Role)
  role: Role;
}
