import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TypeParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  type: string;
}
