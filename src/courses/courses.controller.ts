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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { CoursesListQueryDto } from './dto/courses-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async ensureTeacherOwnsCourse(courseId: string, teacherId: string) {
    const course = await this.coursesService.findDocumentById(courseId);

    if (!course) {
      throw new ForbiddenException('Course not found or access denied');
    }

    if (String(course.teacherId ?? '') !== teacherId) {
      throw new ForbiddenException('Teachers can manage only their own courses');
    }
  }

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@Body() createCourseDto: CreateCourseDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      if (createCourseDto.teacherId && createCourseDto.teacherId !== req.user.userId) {
        throw new ForbiddenException('Teachers can create courses only for themselves');
      }

      createCourseDto.teacherId = req.user.userId;
    }

    const course = await this.coursesService.create(createCourseDto);
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
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  findAll(@Query() query: CoursesListQueryDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      return this.coursesService.findAll({ ...query, teacherId: req.user.userId });
    }

    if (req.user.role === Role.Student) {
      return this.coursesService.findAll({ ...query, studentId: req.user.userId });
    }

    return this.coursesService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student, Role.Extra)
  async findOne(@Param('id') id: string, @Request() req) {
    const course = await this.coursesService.findOne(id);

    if (req.user.role === Role.Teacher && String(course.teacherId?.id ?? course.teacherId ?? '') !== req.user.userId) {
      throw new ForbiddenException('Teachers can access only their own courses');
    }

    if (req.user.role === Role.Student) {
      const students = Array.isArray(course.students) ? course.students : [];
      const isMember = students.some(student => String(student?.id ?? student ?? '') === req.user.userId);
      if (!isMember) {
        throw new ForbiddenException('Students can access only their own courses');
      }
    }

    return course;
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto, @Request() req) {
    if (req.user.role === Role.Teacher) {
      await this.ensureTeacherOwnsCourse(id, req.user.userId);

      if (updateCourseDto.teacherId && updateCourseDto.teacherId !== req.user.userId) {
        throw new ForbiddenException('Teachers cannot reassign courses to another teacher');
      }

      updateCourseDto.teacherId = req.user.userId;
    }

    const course = await this.coursesService.update(id, updateCourseDto);
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
  async remove(@Param('id') id: string, @Request() req) {
    await this.coursesService.remove(id);
    this.auditLogService.log({
      action: 'course.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'course', id },
      status: 'success',
    });
    return { success: true, message: 'Course deleted successfully' };
  }

  @Patch(':id/add-students')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Extra)
  async addStudents(
    @Param('id') courseId: string,
    @Body('studentIds') studentIds: string[],
    @Request() req,
  ) {
    if (req.user.role === Role.Teacher) {
      await this.ensureTeacherOwnsCourse(courseId, req.user.userId);
    }

    const course = await this.coursesService.addManyStudentsToCourse(courseId, studentIds);
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
