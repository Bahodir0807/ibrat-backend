import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student)
  findAll() {
    return this.coursesService.findAll();
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher, Role.Student)
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  @Patch(':id/add-students')
  @Roles(Role.Admin, Role.Owner, Role.Teacher)
  async addStudents(
    @Param('id') courseId: string,
    @Body('studentIds') studentIds: string[],
  ) {
    return this.coursesService.addManyStudentsToCourse(courseId, studentIds);
  }
}
