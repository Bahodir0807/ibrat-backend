import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { UsersListQueryDto } from './dto/users-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get()
  async getAll(@Query() query: UsersListQueryDto) {
    return this.usersService.findAll(query);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get('search')
  async search(
    @Query('username') username?: string,
    @Query('phone') phone?: string,
    @Query('telegramId') telegramId?: string,
  ) {
    if (username) {
      return this.usersService.findByUsername(username);
    }

    if (phone) {
      return this.usersService.findByPhone(phone);
    }

    if (telegramId) {
      return this.usersService.findByTelegramId(Number(telegramId));
    }

    throw new BadRequestException('Provide at least one search parameter');
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner, Role.Teacher)
  @Get('students')
  async getStudents(@Query() query: UsersListQueryDto) {
    return this.usersService.findAll({ ...query, role: Role.Student });
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @UsePipes(new ValidationPipe({ transform: true }))
  @Post()
  async create(@Body() dto: CreateUserDto, @Request() req) {
    const user = await this.usersService.create(dto);
    this.auditLogService.log({
      action: 'user.create',
      actor: { id: req.user.userId, role: req.user.role },
      status: 'success',
      target: { type: 'user', id: user.id },
      metadata: { role: user.role },
    });
    return user;
  }

  @UsePipes(new ValidationPipe({ transform: true }))
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    const requester = req.user;
    const isPrivileged = [Role.Admin, Role.Owner, Role.Extra].includes(requester.role);

    if (!isPrivileged && requester.userId !== id) {
      throw new ForbiddenException('You are not allowed to update this user');
    }

    if (!isPrivileged) {
      const { role, telegramId, roleKey, ...selfPayload } = dto;

      if (role || telegramId || roleKey) {
        throw new ForbiddenException('Self-update is limited to profile fields only');
      }

      const updatedUser = await this.usersService.update(id, selfPayload);
      this.auditLogService.log({
        action: 'user.update.self',
        actor: { id: requester.userId, role: requester.role },
        target: { type: 'user', id },
        status: 'success',
      });
      return updatedUser;
    }

    const updatedUser = await this.usersService.update(id, dto);
    this.auditLogService.log({
      action: 'user.update',
      actor: { id: requester.userId, role: requester.role },
      target: { type: 'user', id },
      status: 'success',
      metadata: { changedRole: dto.role },
    });
    return updatedUser;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: Role, @Request() req) {
    const updatedUser = await this.usersService.updateRole(id, role);
    this.auditLogService.log({
      action: 'user.role.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id },
      status: 'success',
      metadata: { role },
    });
    return updatedUser;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    if (req.user.userId === id) {
      throw new BadRequestException('Self-delete is disabled for safety');
    }

    await this.usersService.remove(id);
    this.auditLogService.log({
      action: 'user.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id },
      status: 'success',
    });
    return { success: true, message: 'User deleted successfully' };
  }
}
