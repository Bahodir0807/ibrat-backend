import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { StudentStatus } from '../student-status.enum';

export class StudentsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(100)
  branchId?: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  courseId?: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  groupId?: string;

  @IsOptional()
  @IsMongoId()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  teacherId?: string;
}
