import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Grade, GradeDocument } from './schemas/grade.schema';

@Injectable()
export class GradesService {
  constructor(
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
  ) {}

  async getByUser(userId: string) {
    return this.gradeModel.find({ user: userId }).exec();
  }

  async add(userId: string, subject: string, score: number) {
    const entry = new this.gradeModel({
      user: new Types.ObjectId(userId),
      subject,
      score,
      date: new Date(),
    });
    return entry.save();
  }

  async update(id: string, score: number) {
    return this.gradeModel.findByIdAndUpdate(id, { score }, { new: true }).exec();
  }

  async remove(id: string) {
    return this.gradeModel.findByIdAndDelete(id).exec();
  }
}