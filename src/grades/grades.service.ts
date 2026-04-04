import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Grade, GradeDocument } from './schemas/grade.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';

@Injectable()
export class GradesService {
  constructor(
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
  ) {}

  async getByUser(userId: string) {
    const grades = await this.gradeModel.find({ user: userId }).sort({ date: -1 }).exec();
    return serializeResources(grades);
  }

  async add(userId: string, subject: string, score: number) {
    const entry = new this.gradeModel({
      user: new Types.ObjectId(userId),
      subject,
      score,
      date: new Date(),
    });
    return serializeResource(await entry.save());
  }

  async update(id: string, score: number) {
    const grade = await this.gradeModel.findByIdAndUpdate(id, { score }, { new: true }).exec();
    return grade ? serializeResource(grade) : null;
  }

  async remove(id: string) {
    const grade = await this.gradeModel.findByIdAndDelete(id).exec();
    return grade ? serializeResource(grade) : null;
  }
}
