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
  UseGuards,
  Request,
  Patch,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get()
  async getAll() {
    return this.usersService.findAll();
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get('search')
  async search(
    @Query('username') username?: string,
    @Query('phone') phone?: string,
    @Query('telegramId') telegramId?: string,
  ) {
    if (username) return this.usersService.findByUsername(username);
    if (phone) return this.usersService.findByPhone(phone);
    if (telegramId) return this.usersService.findByTelegramId(+telegramId);
    throw new BadRequestException('Provide at least one search parameter');
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner, Role.Teacher)
  @Get('students')
  async getStudents() {
    return this.usersService.findByRole(Role.Student);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
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
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    const requester = req.user;

    if (requester.role !== Role.Admin && requester.userId !== id) {
      throw new BadRequestException('You are not allowed to update this user');
    }

    return this.usersService.update(id, dto);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: Role) {
    return this.usersService.updateRole(id, role);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
