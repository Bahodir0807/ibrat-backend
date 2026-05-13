import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../roles/roles.enum';

const optionalTrimmedString = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class RegisterDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  username!: string;

  @IsString()
  password!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  lastName!: string;

  @IsIn([Role.Student, Role.Guest], {
    message:
      'Only "student" and "guest" roles are available during registration',
  })
  @IsOptional()
  role?: Role;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  roleKey?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  telephone?: string;
}
