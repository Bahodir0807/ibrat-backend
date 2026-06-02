import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';

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

export class CreateUserDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must be at most 20 characters long' })
  username!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(50, { message: 'Password must be at most 50 characters long' })
  password!: string;

  @IsOptional()
  @IsIn([Role.Owner, Role.Admin, Role.Teacher], {
    message: 'Role must be one of: owner, admin, teacher',
  })
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'Status must be one of: active, inactive, blocked',
  })
  status?: UserStatus;

  @IsOptional()
  @Transform(({ value }) => {
    const normalized = optionalTrimmedString(value);
    return typeof normalized === 'string'
      ? normalized.toLowerCase()
      : normalized;
  })
  @IsEmail({}, { message: 'Email must be valid' })
  email?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  lastName!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  telephone?: string;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  telegramId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : item))
        .filter((item) => typeof item === 'string' && item.length > 0);
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized ? [normalized] : [];
    }

    return value;
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  branchIds?: string[];
}
