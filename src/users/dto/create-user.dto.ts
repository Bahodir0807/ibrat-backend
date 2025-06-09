import {IsString, MinLength, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть минимум 8 символов' })
  password: string;

  @IsString()
  @IsIn(['student', 'admin','teacher'], { message: 'Роль должна быть "teacher","admin" или "student"' })
  role: string;
}
