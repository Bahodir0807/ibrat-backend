import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

  @IsEnum([Role.Student, Role.Guest], { message: 'При регистрации доступны только роли "student" или "guest"' })
  @IsOptional()
  role?: Role.Student | Role.Guest;

  @IsString()
  @IsOptional()
  roleKey?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
