import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ProjectionType, SortOrder, UpdateQuery } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  find(filter: FilterQuery<UserDocument> = {}, projection?: ProjectionType<UserDocument>) {
    return this.userModel.find(filter, projection);
  }

  findById(id: unknown, projection?: ProjectionType<UserDocument>) {
    return this.userModel.findById(id, projection);
  }

  findOne(filter: FilterQuery<UserDocument>) {
    return this.userModel.findOne(filter);
  }

  countDocuments(filter: FilterQuery<UserDocument>) {
    return this.userModel.countDocuments(filter);
  }

  create(payload: Partial<User>) {
    return new this.userModel(payload);
  }

  updateById(id: string, payload: UpdateQuery<UserDocument>) {
    return this.userModel.findByIdAndUpdate(id, payload, { new: true });
  }

  findByIdAndUpdate(id: string, payload: UpdateQuery<UserDocument>, options?: Record<string, unknown>) {
    return this.userModel.findByIdAndUpdate(id, payload, options);
  }

  deleteById(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }

  findByIdAndDelete(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }

  exists(filter: FilterQuery<UserDocument>) {
    return this.userModel.exists(filter);
  }

  sortOrder(sortBy: string, sortOrder: SortOrder) {
    return { [sortBy]: sortOrder };
  }
}
