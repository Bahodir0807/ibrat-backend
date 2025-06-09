import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsMongoId()
  @IsOptional()
  courseId?: string;
}
