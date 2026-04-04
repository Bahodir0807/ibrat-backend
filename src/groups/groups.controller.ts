import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { Role } from 'src/roles/roles.enum';
import { CreateGroupDto } from './dto/create-group.dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto/update-group.dto';
import { GroupsService } from './groups.service';
import { GroupsListQueryDto } from './dto/groups-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async ensureTeacherOwnsGroup(groupId: string, teacherId: string) {
    const group = await this.groupsService.findDocumentById(groupId);

    if (!group) {
      throw new ForbiddenException('Group not found or access denied');
    }

    if (String(group.teacher ?? '') !== teacherId) {
      throw new ForbiddenException('Teachers can manage only their own groups');
    }
  }

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreateGroupDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      if (dto.teacher && dto.teacher !== req.user.userId) {
        throw new ForbiddenException('Teachers can create groups only for themselves');
      }

      dto.teacher = req.user.userId;
    }

    return this.groupsService.create(dto).then(group => {
      this.auditLogService.log({
        action: 'group.create',
        actor: { id: req.user.userId, role: req.user.role },
        target: { type: 'group', id: group.id },
        status: 'success',
      });
      return group;
    });
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() query: GroupsListQueryDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      return this.groupsService.findAll({ ...query, teacherId: req.user.userId });
    }

    if (req.user.role === Role.Student) {
      return this.groupsService.findAll({ ...query, studentId: req.user.userId });
    }

    return this.groupsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param('id') id: string, @Request() req) {
    const group = await this.groupsService.findOne(id);

    if (req.user.role === Role.Teacher && String(group.teacher?.id ?? group.teacher ?? '') !== req.user.userId) {
      throw new ForbiddenException('Teachers can access only their own groups');
    }

    if (req.user.role === Role.Student) {
      const students = Array.isArray(group.students) ? group.students : [];
      const isMember = students.some(student => String(student?.id ?? student ?? '') === req.user.userId);
      if (!isMember) {
        throw new ForbiddenException('Students can access only their own groups');
      }
    }

    return group;
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateGroupDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      await this.ensureTeacherOwnsGroup(id, req.user.userId);

      if (dto.teacher && dto.teacher !== req.user.userId) {
        throw new ForbiddenException('Teachers cannot reassign groups to another teacher');
      }

      dto.teacher = req.user.userId;
    }

    const group = await this.groupsService.update(id, dto);
    this.auditLogService.log({
      action: 'group.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'group', id },
      status: 'success',
    });
    return group;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param('id') id: string, @Request() req) {
    await this.groupsService.remove(id);
    this.auditLogService.log({
      action: 'group.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'group', id },
      status: 'success',
    });
    return { success: true, message: 'Group deleted successfully' };
  }
}
