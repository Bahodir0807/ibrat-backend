import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { RoomType } from '../schemas/room.schema';

export class RoomsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;
}
