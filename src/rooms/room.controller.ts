import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
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
  create(@Body() dto: CreateRoomDto, @Request() req) {
    return this.roomService.createForActor(dto, req.user);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findAll(@Query() query: RoomsListQueryDto, @Request() req) {
    return this.roomService.findAllForActor(query, req.user);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findOne(@Param() params: IdParamDto, @Request() req) {
    return this.roomService.findByIdForActor(params.id, req.user);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  update(@Param() params: IdParamDto, @Body() dto: UpdateRoomDto, @Request() req) {
    return this.roomService.updateForActor(params.id, dto, req.user);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto, @Request() req) {
    await this.roomService.removeForActor(params.id, req.user);
    return { message: 'Room deleted successfully' };
  }
}
