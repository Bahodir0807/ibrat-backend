import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ProjectionType, UpdateQuery } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsRepository {
  constructor(@InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>) {}

  find(filter: FilterQuery<GroupDocument> = {}, projection?: ProjectionType<GroupDocument>) {
    return this.groupModel.find(filter, projection);
  }

  findById(id: unknown, projection?: ProjectionType<GroupDocument>) {
    return this.groupModel.findById(id, projection);
  }

  countDocuments(filter: FilterQuery<GroupDocument>) {
    return this.groupModel.countDocuments(filter);
  }

  create(payload: Record<string, unknown>) {
    return this.groupModel.create(payload);
  }

  updateById(id: string, payload: UpdateQuery<GroupDocument>) {
    return this.groupModel.findByIdAndUpdate(id, payload, { new: true });
  }

  deleteById(id: string) {
    return this.groupModel.findByIdAndDelete(id);
  }

  exists(filter: FilterQuery<GroupDocument>) {
    return this.groupModel.exists(filter);
  }
}
