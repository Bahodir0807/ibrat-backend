import { ArrayNotEmpty, ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class AddCourseStudentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds: string[];
}
