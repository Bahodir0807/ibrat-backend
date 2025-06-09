import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Post()
  async create(@Body() dto: CreateUserDto) {
    try {
      return await this.usersService.create(dto);
    } catch (e) {
      throw new BadRequestException(e.message);
    }
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
