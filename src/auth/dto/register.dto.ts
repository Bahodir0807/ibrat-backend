import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  roleKey?: string;
}
