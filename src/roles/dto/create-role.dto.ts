import { IsString, ArrayNotEmpty, ArrayUnique } from 'class-validator';

export class CreateRoleDto {
  @IsString() 
  readonly name: string;

  @ArrayNotEmpty()
  @ArrayUnique()
  readonly permissions: string[];
}
