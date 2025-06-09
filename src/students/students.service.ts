import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateStudentDto): Promise<Student> {
    const createdStudent = new this.studentModel(dto);
    return createdStudent.save();
  }

  async findAll(): Promise<Student[]> {
    return this.studentModel.find()
      .populate('course')
      .populate('teacher')
      .exec();
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentModel.findById(id)
      .populate('course')
      .populate('teacher')
      .exec();
    if (!student) throw new NotFoundException('Студент не найден');
    return student;
  }

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const updated = await this.studentModel.findByIdAndUpdate(id, dto, { new: true })
      .populate('course')
      .populate('teacher')
      .exec();
    if (!updated) throw new NotFoundException('Студент не найден');
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.studentModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Студент не найден');
    return true;
  }
}
