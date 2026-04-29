import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { RoomsListQueryDto } from './dto/rooms-list-query.dto';
import { IdParamDto } from '../common/dto/id-param.dto';

@Controller('rooms')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.create(dto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  findAll(@Query() query: RoomsListQueryDto) {
    return this.roomService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  findOne(@Param() params: IdParamDto) {
    return this.roomService.findById(params.id);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  update(@Param() params: IdParamDto, @Body() dto: UpdateRoomDto) {
    return this.roomService.update(params.id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto) {
    await this.roomService.remove(params.id);
    return { message: 'Room deleted successfully' };
  }
}
