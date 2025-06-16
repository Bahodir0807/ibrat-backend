import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateHomeworkDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
