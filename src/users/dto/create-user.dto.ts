import { IsString, MinLength, MaxLength, IsEnum, IsEmail, IsOptional } from 'class-validator';
import { Role } from '../../roles/roles.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: 'Имя должно быть не менее 3 символов' })
  @MaxLength(20, { message: 'Имя должно быть не более 20 символов' })
  username: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не менее 8 символов' })
  @MaxLength(20, { message: 'Пароль должен быть не более 20 символов' })
  password: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Роль должна быть "teacher", "admin", "student", "owner" или "parent"' })
  role?: Role;

  @IsOptional()
  @IsEmail({}, { message: 'Некорректный email' })
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

}
