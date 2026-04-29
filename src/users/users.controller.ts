import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { UsersListQueryDto } from './dto/users-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Patch('me/profile')
  async updateMyProfile(@Body() dto: UpdateProfileDto, @Request() req) {
    const user = await this.usersService.updateOwnProfile(req.user.userId, dto);
    this.auditLogService.log({
      action: 'user.profile.update',
      actor: { id: req.user.userId, role: req.user.role },
      status: 'success',
      target: { type: 'user', id: req.user.userId },
    });
    return user;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get()
  async getAll(@Query() query: UsersListQueryDto, @Request() req) {
    return this.usersService.findAllForActor(query, req.user as AuthenticatedUser);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get('search')
  async search(@Query() query: SearchUsersQueryDto, @Request() req) {
    const { username, phone, telegramId } = query;
    const providedSearchKeys = [username, phone, telegramId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );

    if (providedSearchKeys.length === 0) {
      throw new BadRequestException('Provide exactly one search parameter');
    }

    if (providedSearchKeys.length > 1) {
      throw new BadRequestException('Use exactly one search parameter at a time');
    }

    const user = await this.usersService.searchForActor(query, req.user as AuthenticatedUser);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner, Role.Teacher)
  @Get('students')
  async getStudents(@Query() query: UsersListQueryDto, @Request() req) {
    return this.usersService.findStudentsForActor(query, req.user as AuthenticatedUser);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Get(':id')
  async getOne(@Param() params: IdParamDto, @Request() req) {
    return this.usersService.findByIdForActor(params.id, req.user as AuthenticatedUser);
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Post()
  async create(@Body() dto: CreateUserDto, @Request() req) {
    const user = await this.usersService.createForActor(dto, req.user as AuthenticatedUser);
    this.auditLogService.log({
      action: 'user.create',
      actor: { id: req.user.userId, role: req.user.role },
      status: 'success',
      target: { type: 'user', id: user.id },
      metadata: { role: user.role, status: user.status },
    });
    return user;
  }

  @Put(':id')
  async update(@Param() params: IdParamDto, @Body() dto: UpdateUserDto, @Request() req) {
    const { id } = params;
    const requester = req.user as AuthenticatedUser;
    const updatedUser = await this.usersService.updateForActor(id, dto, requester);
    this.auditLogService.log({
      action: requester.userId === id ? 'user.update.self' : 'user.update',
      actor: { id: requester.userId, role: requester.role },
      target: { type: 'user', id },
      status: 'success',
    });
    return updatedUser;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Patch(':id/role')
  async updateRole(@Param() params: IdParamDto, @Body() dto: UpdateUserRoleDto, @Request() req) {
    const { id } = params;
    const updatedUser = await this.usersService.updateRoleForActor(
      id,
      dto.role,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'user.role.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id },
      status: 'success',
      metadata: { role: dto.role },
    });
    return updatedUser;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Patch(':id/status')
  async updateStatus(
    @Param() params: IdParamDto,
    @Body() dto: UpdateUserStatusDto,
    @Request() req,
  ) {
    const { id } = params;
    if (req.user.userId === id) {
      throw new BadRequestException('Self-status change is not allowed');
    }

    const updatedUser = await this.usersService.updateStatusForActor(
      id,
      dto,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'user.status.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id },
      status: 'success',
      metadata: { status: dto.status },
    });
    return updatedUser;
  }

  @Roles(Role.Admin, Role.Extra, Role.Owner)
  @Delete(':id')
  async remove(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    if (req.user.userId === id) {
      throw new BadRequestException('Self-delete is disabled for safety');
    }

    await this.usersService.removeForActor(id, req.user as AuthenticatedUser);
    this.auditLogService.log({
      action: 'user.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id },
      status: 'success',
    });
    return { message: 'User deleted successfully' };
  }
}
