import { IsString, IsOptional } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  group?: string;

  @IsString()
  @IsOptional()
  courseId?: string;    

  @IsString()
  @IsOptional()
  teacherId?: string;  
}