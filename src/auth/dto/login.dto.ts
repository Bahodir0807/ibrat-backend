import { Transform } from 'class-transformer';
import { IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf(dto => !dto.login)
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  username?: string;

  @ValidateIf(dto => !dto.username)
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  login?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
