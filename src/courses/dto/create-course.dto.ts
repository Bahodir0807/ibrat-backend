import { IsArray, IsMongoId, IsOptional, IsString } from "class-validator";

export class CreateCourseDto {
  @IsString()
  name: string;
  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  price?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  students?: string[];
}
