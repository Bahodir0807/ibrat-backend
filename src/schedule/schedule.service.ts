import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Schedule } from '././schemas/schedule.schema'; 
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';
import { Course } from '../courses/schemas/course.schema';
import { Document } from 'mongoose';
export type ScheduleDocument = Schedule & Document;
export type CourseDocument = Course & Document;

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name) private readonly schModel: Model<ScheduleDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
  ) {}

  async create(dto: CreateScheduleDto) {
    const schedule = new this.schModel({
      ...dto,
      course: dto.courseId,
      teacher: dto.teacherId,
      room: dto.roomId,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
    });
    const created = await schedule.save();

    await this.courseModel.findByIdAndUpdate(dto.courseId, {
      $push: { schedule: created._id },
    }).exec();

    return created;
  }

  async findAll() {
    return this.schModel.find()
      .populate('course', 'title')
      .populate('teacher', 'name')
      .populate('room', 'name')
      .exec();
  }

  async findOne(id: string) {
    const schedule = await this.schModel.findById(id)
      .populate('course', 'title')
      .populate('teacher', 'name')
      .populate('room', 'name')
      .exec();
    if (!schedule) throw new NotFoundException('Расписание не найдено');
    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto) {
    const updated = await this.schModel.findByIdAndUpdate(
      id,
      {
        ...dto,
        ...(dto.startTime && { startTime: new Date(dto.startTime) }),
        ...(dto.endTime && { endTime: new Date(dto.endTime) }),
        ...(dto.courseId && { course: dto.courseId }),
        ...(dto.teacherId && { teacher: dto.teacherId }),
        ...(dto.roomId && { room: dto.roomId }),
      },
      { new: true },
    )
      .populate('course', 'title')
      .populate('teacher', 'name')
      .populate('room', 'name')
      .exec();
    if (!updated) throw new NotFoundException('Расписание не найдено');
    return updated;
  }

  async remove(id: string) {
    const removed = await this.schModel.findByIdAndDelete(id).exec();
    if (!removed) throw new NotFoundException('Расписание не найдено');
    return removed;
  }
}
