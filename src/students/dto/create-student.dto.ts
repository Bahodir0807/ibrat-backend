import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsMongoId()
  @IsOptional()
  courseId?: string;    

  @IsMongoId()
  @IsOptional()
  teacherId?: string;  
}
