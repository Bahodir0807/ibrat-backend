import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  password: string;

@IsIn([Role.Student, Role.Guest], { message: 'При регистрации доступны только роли "student" или "guest"' })
@IsOptional()
role?: Role;

  @IsString()
  @IsOptional()
  roleKey?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}
