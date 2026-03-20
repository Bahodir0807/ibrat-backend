import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/shedule.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name) private readonly schModel: Model<ScheduleDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
  ) {}

  private readonly schedulePopulate = [
    { path: 'course', select: 'name description price teacherId students' },
    { path: 'teacher', select: 'username firstName lastName role' },
    { path: 'students', select: 'username firstName lastName role' },
    { path: 'room', select: 'name capacity type isAvailable' },
    { path: 'group', select: 'name' },
  ];

  async getScheduleForUser(userId: string, role: string) {
    if (role === 'student') {
      return this.schModel
        .find({ students: userId })
        .populate(this.schedulePopulate)
        .sort({ date: 1, timeStart: 1 })
        .exec();
    }

    if (role === 'teacher') {
      return this.schModel
        .find({ teacher: userId })
        .populate(this.schedulePopulate)
        .sort({ date: 1, timeStart: 1 })
        .exec();
    }

    if ([ 'admin', 'owner', 'panda' ].includes(role)) {
      return this.schModel
        .find()
        .populate(this.schedulePopulate)
        .sort({ date: 1, timeStart: 1 })
        .exec();
    }

    throw new ForbiddenException('No access to schedule');
  }

  async findAll() {
    return this.schModel
      .find()
      .populate(this.schedulePopulate)
      .sort({ date: 1, timeStart: 1 })
      .exec();
  }

  async findOne(id: string) {
    const schedule = await this.schModel.findById(id).populate(this.schedulePopulate).exec();
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async create(createScheduleDto: CreateScheduleDto) {
    const schedule = new this.schModel(createScheduleDto);
    return schedule.save();
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const updated = await this.schModel
      .findByIdAndUpdate(id, updateScheduleDto, { new: true })
      .populate(this.schedulePopulate)
      .exec();

    if (!updated) {
      throw new NotFoundException('Schedule not found');
    }

    return updated;
  }

  async remove(id: string) {
    const deleted = await this.schModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Schedule not found');
    }

    return deleted;
  }
}
