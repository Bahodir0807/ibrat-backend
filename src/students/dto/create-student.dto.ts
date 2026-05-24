import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StudentStatus } from '../student-status.enum';

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

const normalizeStringArray = (value: unknown) => {
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
};

export class CreateStudentDto {
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
  @MaxLength(100)
  telegramId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(30)
  parentPhoneNumber?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(100)
  parentName?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  groupIds?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  courseIds?: string[];

  @IsOptional()
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  branchIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyPayment?: number;

  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => optionalTrimmedString(value))
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}
