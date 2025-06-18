import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Homework, HomeworkDocument } from './schemas/homework.schema';
import { CreateHomeworkDto } from './dto/create-homework.dto';

@Injectable()
export class HomeworkService {
  constructor(
    @InjectModel(Homework.name) private readonly hwModel: Model<HomeworkDocument>,
  ) {}

  async getByUser(userId: string) {
    return this.hwModel.find({ user: userId }).exec();
  }

  async create(dto: CreateHomeworkDto) {
    const entry = new this.hwModel({
      user: new Types.ObjectId(dto.userId),
      date: new Date(dto.date),
      tasks: dto.tasks,
    });
    return entry.save();
  }
  

  async markComplete(id: string) {
    return this.hwModel.findByIdAndUpdate(id, { completed: true }, { new: true }).exec();
  }
}