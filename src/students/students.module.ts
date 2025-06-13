import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import { Teacher, TeacherSchema } from '../teachers/schemas/teacher.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Teacher.name, schema: TeacherSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  providers: [StudentsService],
  controllers: [StudentsController],
})
export class StudentsModule {}
