import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { RoomsListQueryDto } from './dto/rooms-list-query.dto';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.create(dto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() query: RoomsListQueryDto) {
    return this.roomService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  findOne(@Param('id') id: string) {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param('id') id: string) {
    await this.roomService.remove(id);
    return { success: true, message: 'Room deleted successfully' };
  }
}
