import { IsMongoId } from 'class-validator';

export class StudentIdParamDto {
  @IsMongoId()
  studentId: string;
}
