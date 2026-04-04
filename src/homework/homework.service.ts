import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Homework, HomeworkDocument } from './schemas/homework.schema';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';

@Injectable()
export class HomeworkService {
  constructor(
    @InjectModel(Homework.name) private readonly hwModel: Model<HomeworkDocument>,
  ) {}

  async getByUser(userId: string) {
    const homework = await this.hwModel.find({ user: userId }).sort({ date: -1 }).exec();
    return serializeResources(homework);
  }

  async create(dto: CreateHomeworkDto) {
    const entry = new this.hwModel({
      user: new Types.ObjectId(dto.userId),
      date: new Date(dto.date),
      tasks: dto.tasks,
    });
    return serializeResource(await entry.save());
  }
  

  async markComplete(id: string, actor?: { userId: string; role: string }) {
    const homework = await this.hwModel.findById(id).exec();
    if (!homework) {
      throw new NotFoundException('Homework not found');
    }

    if (actor?.role === 'student' && String(homework.user) !== actor.userId) {
      throw new ForbiddenException('Students can complete only their own homework');
    }

    homework.completed = true;
    await homework.save();
    return serializeResource(homework);
  }
}
