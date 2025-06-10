import { IsString, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  readonly name: string;

  @IsOptional()
  @IsString()
  readonly description?: string;
}