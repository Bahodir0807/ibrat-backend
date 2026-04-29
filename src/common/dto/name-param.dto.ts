import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class NameParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[\w.-]+$/i, { message: 'name must contain only letters, numbers, dots, dashes or underscores' })
  name: string;
}
