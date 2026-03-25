import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RoomType } from '../schemas/room.schema';

export class CreateRoomDto {
  @IsString()
  readonly name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly capacity: number;

  @IsEnum(RoomType)
  readonly type: RoomType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readonly isAvailable?: boolean;

  @IsOptional()
  @IsString()
  readonly description?: string;
}
