import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UserIdParamDto } from '../common/dto/user-id-param.dto';
import { IdParamDto } from '../common/dto/id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('homework')
export class HomeworkController {
  constructor(
    private readonly hwService: HomeworkService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  @Roles(Role.Student)
  async getMine(@Request() req) {
    return this.hwService.getByUserForActor(req.user.userId, req.user as AuthenticatedUser);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param() params: UserIdParamDto, @Request() req) {
    const { userId } = params;
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own homework');
    }

    return this.hwService.getByUserForActor(userId, req.user as AuthenticatedUser);
  }

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  async create(@Body() dto: CreateHomeworkDto, @Request() req) {
    return this.hwService.createForActor(dto, req.user as AuthenticatedUser);
  }

  @Patch(':id/complete')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async complete(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    const homework = await this.hwService.markCompleteForActor(id, req.user as AuthenticatedUser);
    this.auditLogService.log({
      action: 'homework.complete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'homework', id },
      status: 'success',
    });
    return homework;
  }
}
