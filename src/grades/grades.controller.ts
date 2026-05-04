import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { IdParamDto } from '../common/dto/id-param.dto';
import { UserIdParamDto } from '../common/dto/user-id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('grades')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  @Roles(Role.Student)
  async getMine(@Request() req) {
    return this.gradesService.getByUserForActor(req.user.userId, req.user as AuthenticatedUser);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student, Role.Extra)
  async getByUser(@Param() params: UserIdParamDto, @Request() req) {
    const { userId } = params;
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own grades');
    }

    return this.gradesService.getByUserForActor(userId, req.user as AuthenticatedUser);
  }

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Extra)
  async add(@Body() dto: CreateGradeDto, @Request() req) {
    const grade = await this.gradesService.addForActor(
      dto.userId,
      dto.subject,
      dto.score,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'grade.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'grade', id: grade.id },
      status: 'success',
      metadata: { userId: dto.userId, subject: dto.subject },
    });
    return grade;
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Extra)
  async update(@Param() params: IdParamDto, @Body() dto: UpdateGradeDto, @Request() req) {
    const grade = await this.gradesService.updateForActor(params.id, dto.score, req.user as AuthenticatedUser);
    this.auditLogService.log({
      action: 'grade.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'grade', id: params.id },
      status: 'success',
    });
    return grade;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto, @Request() req) {
    const grade = await this.gradesService.removeForActor(
      params.id,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'grade.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'grade', id: params.id },
      status: 'success',
    });
    return { message: 'Grade deleted successfully', deleted: grade };
  }
}
