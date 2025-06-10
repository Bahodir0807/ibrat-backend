import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course } from './schemas/course.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { CourseDocument } from 'src/schedule/schedule.service';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
  ) {}

  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    const createdCourse = new this.courseModel(createCourseDto);
    return createdCourse.save();
  }

  async findAll(): Promise<Course[]> {
    return this.courseModel.find().populate('teacherId').exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invalid course ID');
    const course = await this.courseModel.findById(id).populate('teacherId').exec();
    if (!course) throw new NotFoundException('Course not found');

    const students = await this.studentModel.find({ course: id }).exec();

    return { course, students };
  }

  async update(id: string, updateCourseDto: UpdateCourseDto): Promise<Course> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invalid course ID');

    const updatedCourse = await this.courseModel.findByIdAndUpdate(id, updateCourseDto, { new: true }).exec();
    if (!updatedCourse) throw new NotFoundException('Course not found');

    return updatedCourse;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invalid course ID');

    const result = await this.courseModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Course not found');
  }
}
