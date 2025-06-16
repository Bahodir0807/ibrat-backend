import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Homework, HomeworkDocument } from './schemas/homework.schema';

@Injectable()
export class HomeworkService {
  constructor(
    @InjectModel(Homework.name) private readonly hwModel: Model<HomeworkDocument>,
  ) {}

  async getByUser(userId: string) {
    return this.hwModel.find({ user: userId }).exec();
  }

  async add(userId: string, date: string, tasks: string[]) {
    const entry = new this.hwModel({
      user: new Types.ObjectId(userId),
      date: new Date(date),
      tasks,
    });
    return entry.save();
  }

  async markComplete(id: string) {
    return this.hwModel.findByIdAndUpdate(id, { completed: true }, { new: true }).exec();
  }
}