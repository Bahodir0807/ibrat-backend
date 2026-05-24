import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request } from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentsListQueryDto } from './dto/students-list-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Roles(Role.Owner, Role.Admin, Role.Extra, Role.BranchAdmin, Role.Teacher)
  @Get()
  findAll(@Query() query: StudentsListQueryDto, @Request() req) {
    return this.studentsService.findAll(query, req.user as AuthenticatedUser);
  }

  @Roles(Role.Owner, Role.Admin, Role.Extra, Role.BranchAdmin, Role.Teacher)
  @Get(':id')
  findOne(@Param() params: IdParamDto, @Request() req) {
    return this.studentsService.findById(
      params.id,
      req.user as AuthenticatedUser,
    );
  }

  @Roles(Role.Owner, Role.Admin, Role.Extra, Role.BranchAdmin)
  @Post()
  async create(@Body() dto: CreateStudentDto, @Request() req) {
    const student = await this.studentsService.create(
      dto,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'student.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'student', id: student.id },
      status: 'success',
    });
    return student;
  }

  @Roles(Role.Owner, Role.Admin, Role.Extra, Role.BranchAdmin)
  @Patch(':id')
  async update(
    @Param() params: IdParamDto,
    @Body() dto: UpdateStudentDto,
    @Request() req,
  ) {
    const student = await this.studentsService.update(
      params.id,
      dto,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'student.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'student', id: params.id },
      status: 'success',
    });
    return student;
  }

  @Roles(Role.Owner, Role.Admin, Role.Extra, Role.BranchAdmin)
  @Delete(':id')
  async remove(@Param() params: IdParamDto, @Request() req) {
    const student = await this.studentsService.softDelete(
      params.id,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'student.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'student', id: params.id },
      status: 'success',
    });
    return student;
  }
}
