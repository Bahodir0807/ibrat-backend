import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/shedule.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name) private schModel: Model<ScheduleDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
  ) {}

  async getScheduleForUser(userId: string, role: string) {
    try {
      if (role === 'student') {
        return await this.schModel
          .find({ student: new Types.ObjectId(userId) })
          .populate('course', 'title')
          .exec();
      } else if (role === 'teacher') {
        return await this.schModel
          .find({ teacher: new Types.ObjectId(userId) })
          .populate('course', 'title')
          .exec();
      } else if (role === 'admin') {
        return await this.schModel
          .find()
          .populate('course', 'title')
          .populate('teacher', 'name')
          .populate('student', 'name')
          .populate('room', 'name')
          .exec();
      } else {
        throw new ForbiddenException('Нет доступа к расписанию');
      }
    } catch (error) {
      throw new ForbiddenException('Ошибка при получении расписания');
    }
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

  async create(createScheduleDto: CreateScheduleDto) {
    try {
      const schedule = new this.schModel(createScheduleDto);
      return await schedule.save();
    } catch (error) {
      throw new ForbiddenException('Ошибка при создании расписания');
    }
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const updated = await this.schModel.findByIdAndUpdate(
      id,
      updateScheduleDto,
      { new: true }
    ).exec();
    if (!updated) throw new NotFoundException('Расписание не найдено');
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.schModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Расписание не найдено');
    return deleted;
  }
}