import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ProjectionType, UpdateQuery } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/schedule.schema';

@Injectable()
export class ScheduleRepository {
  constructor(@InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>) {}

  find(filter: FilterQuery<ScheduleDocument> = {}, projection?: ProjectionType<ScheduleDocument>) {
    return this.scheduleModel.find(filter, projection);
  }

  findById(id: unknown, projection?: ProjectionType<ScheduleDocument>) {
    return this.scheduleModel.findById(id, projection);
  }

  findOne(filter: FilterQuery<ScheduleDocument>) {
    return this.scheduleModel.findOne(filter);
  }

  countDocuments(filter: FilterQuery<ScheduleDocument>) {
    return this.scheduleModel.countDocuments(filter);
  }

  create(payload: Record<string, unknown>) {
    return this.scheduleModel.create(payload);
  }

  updateById(id: string, payload: UpdateQuery<ScheduleDocument>) {
    return this.scheduleModel.findByIdAndUpdate(id, payload, { new: true });
  }

  findByIdAndUpdate(id: string, payload: UpdateQuery<ScheduleDocument>, options?: Record<string, unknown>) {
    return this.scheduleModel.findByIdAndUpdate(id, payload, options);
  }

  deleteById(id: string) {
    return this.scheduleModel.findByIdAndDelete(id);
  }

  findByIdAndDelete(id: string) {
    return this.scheduleModel.findByIdAndDelete(id);
  }
}
