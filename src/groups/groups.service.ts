import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateGroupDto } from './dto/create-group.dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto/update-group.dto';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
  ) {}

  private readonly groupPopulate = [
    { path: 'course', select: 'name description price' },
    { path: 'teacher', select: 'username firstName lastName role' },
    { path: 'students', select: 'username firstName lastName role' },
  ];

  create(dto: CreateGroupDto) {
    return new this.groupModel(dto).save();
  }

  findAll() {
    return this.groupModel.find().populate(this.groupPopulate).exec();
  }

  async findOne(id: string) {
    const group = await this.groupModel.findById(id).populate(this.groupPopulate).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async update(id: string, dto: UpdateGroupDto) {
    const updated = await this.groupModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate(this.groupPopulate)
      .exec();

    if (!updated) {
      throw new NotFoundException('Group not found');
    }

    return updated;
  }

  async remove(id: string) {
    const deleted = await this.groupModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Group not found');
    }

    return { success: true };
  }
}
