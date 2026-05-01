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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { CoursesListQueryDto } from './dto/courses-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';
import { AddCourseStudentsDto } from './dto/add-course-students.dto';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async create(@Body() createCourseDto: CreateCourseDto, @Request() req) {
    const course = await this.coursesService.createForActor(createCourseDto, req.user);
    this.auditLogService.log({
      action: 'course.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'course', id: course.id },
      status: 'success',
    });
    return course;
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  findAll(@Query() query: CoursesListQueryDto, @Request() req) {
    return this.coursesService.findAllForActor(query, req.user);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param() params: IdParamDto, @Request() req) {
    return this.coursesService.findOneForActor(params.id, req.user);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async update(@Param() params: IdParamDto, @Body() updateCourseDto: UpdateCourseDto, @Request() req) {
    const { id } = params;
    const course = await this.coursesService.updateForActor(id, updateCourseDto, req.user);
    this.auditLogService.log({
      action: 'course.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'course', id },
      status: 'success',
    });
    return course;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async remove(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    await this.coursesService.removeForActor(id, req.user);
    this.auditLogService.log({
      action: 'course.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'course', id },
      status: 'success',
    });
    return { message: 'Course deleted successfully' };
  }

  @Patch(':id/add-students')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async addStudents(
    @Param() params: IdParamDto,
    @Body() dto: AddCourseStudentsDto,
    @Request() req,
  ) {
    const { id: courseId } = params;
    const { studentIds } = dto;
    const course = await this.coursesService.addManyStudentsToCourseForActor(courseId, studentIds, req.user);
    this.auditLogService.log({
      action: 'course.students.add',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'course', id: courseId },
      status: 'success',
      metadata: { addedStudentsCount: Array.isArray(studentIds) ? studentIds.length : 0 },
    });
    return course;
  }
}
