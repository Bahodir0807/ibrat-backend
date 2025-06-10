import { IsString, IsEnum, MinLength } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;
}
