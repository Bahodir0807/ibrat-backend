import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course, CourseDocument } from './schemas/course.schema';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
  ) {}
  async addManyStudentsToCourse(courseId: string, studentIds: string[]): Promise<Course> {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Курс не найден');
  
    course.students ??= [];
  
    const currentIds = course.students.map(id => id.toString());
  
    const uniqueNewStudents = studentIds
      .filter(id => Types.ObjectId.isValid(id))
      .filter(id => !currentIds.includes(id))
      .map(id => new Types.ObjectId(id));
  
    course.students.push(...uniqueNewStudents);
    await course.save();
  
    return course;
  }
  
  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    try {
      const { teacherId, ...rest } = createCourseDto;
  
      if (teacherId && !Types.ObjectId.isValid(teacherId)) {
        throw new NotFoundException('Неверный ID учителя');
      }
  
      const createdCourse = new this.courseModel({
        ...rest,
        teacherId: teacherId ? new Types.ObjectId(teacherId) : undefined,
      });
  
      return await createdCourse.save();
    } catch (err) {
      console.error('❌ Ошибка при создании курса:', err);
      throw err;
    }
  }
  
  async addStudentToCourse(courseId: string, studentId: string): Promise<Course> {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Курс не найден');
  
    course.students ??= [];

    const currentStudents = course.students.map(id => id.toString());
    
    if (!currentStudents.includes(studentId)) {
      course.students.push(new Types.ObjectId(studentId));
      await course.save();
    }
    
    return course;
  }

  async findAll(): Promise<Course[]> {
    return this.courseModel.find().populate('teacherId').exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invalid course ID');
    const course = await this.courseModel.findById(id).populate('teacherId').exec();
    if (!course) throw new NotFoundException('Course not found');

    return course;
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
