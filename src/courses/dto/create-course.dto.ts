import { IsString, IsOptional, IsArray, IsMongoId } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  students?: string[];

}
