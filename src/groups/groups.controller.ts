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
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';
import { GroupsListQueryDto } from './dto/groups-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async create(@Body() dto: CreateGroupDto, @Request() req) {
    const group = await this.groupsService.createForActor(dto, req.user);
    this.auditLogService.log({
      action: 'group.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'group', id: group.id },
      status: 'success',
    });
    return group;
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findAll(@Query() query: GroupsListQueryDto, @Request() req) {
    return this.groupsService.findAllForActor(query, req.user);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param() params: IdParamDto, @Request() req) {
    return this.groupsService.findOneForActor(params.id, req.user);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async update(@Param() params: IdParamDto, @Body() dto: UpdateGroupDto, @Request() req) {
    const { id } = params;
    const group = await this.groupsService.updateForActor(id, dto, req.user);
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
  async remove(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    await this.groupsService.remove(id);
    this.auditLogService.log({
      action: 'group.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'group', id },
      status: 'success',
    });
    return { message: 'Group deleted successfully' };
  }
}
