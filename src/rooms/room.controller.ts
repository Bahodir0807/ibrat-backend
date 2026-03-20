import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner)
  create(@Body() dto: CreateRoomDto) {
    return this.roomService.create(dto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  findAll() {
    return this.roomService.findAll();
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  findOne(@Param('id') id: string) {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner)
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.roomService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  remove(@Param('id') id: string) {
    return this.roomService.remove(id);
  }
}
