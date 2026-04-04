import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { CreateGroupDto } from './dto/create-group.dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto/update-group.dto';
import { Group, GroupDocument } from './schemas/group.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { GroupsListQueryDto } from './dto/groups-list-query.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
  ) {}

  private readonly groupPopulate = [
    { path: 'course', select: 'name description price teacherId students' },
    { path: 'teacher', select: 'username firstName lastName role email phoneNumber' },
    { path: 'students', select: 'username firstName lastName role email phoneNumber' },
  ];

  async findDocumentById(id: string): Promise<GroupDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.groupModel.findById(id).exec();
  }

  private toObjectId(id?: string): Types.ObjectId | undefined {
    if (!id) {
      return undefined;
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Mongo ID');
    }

    return new Types.ObjectId(id);
  }

  private normalizePayload(dto: CreateGroupDto | UpdateGroupDto) {
    const payload: Record<string, unknown> = { ...dto };

    if ('course' in dto && dto.course !== undefined) {
      payload.course = this.toObjectId(dto.course);
    }

    if ('teacher' in dto && dto.teacher !== undefined) {
      payload.teacher = this.toObjectId(dto.teacher);
    }

    if ('students' in dto && dto.students !== undefined) {
      payload.students = Array.from(
        new Set((dto.students ?? []).map(studentId => this.toObjectId(studentId)!.toString())),
      ).map(studentId => new Types.ObjectId(studentId));
    }

    return payload;
  }

  private getSort(query: GroupsListQueryDto) {
    const sortBy = query.sortBy && ['name', 'createdAt'].includes(query.sortBy)
      ? query.sortBy
      : 'name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  async create(dto: CreateGroupDto) {
    const created = await this.groupModel.create(this.normalizePayload(dto));
    return this.findOne(String(created._id));
  }

  async findAll(query: GroupsListQueryDto = {}) {
    const filter: FilterQuery<GroupDocument> = {};

    if (query.teacherId) {
      filter.teacher = this.toObjectId(query.teacherId);
    }

    if (query.courseId) {
      filter.course = this.toObjectId(query.courseId);
    }

    if (query.studentId) {
      filter.students = this.toObjectId(query.studentId);
    }

    if (query.search?.trim()) {
      filter.name = new RegExp(query.search.trim(), 'i');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const groups = await this.groupModel
      .find(filter)
      .populate(this.groupPopulate)
      .sort(this.getSort(query))
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return serializeResources(groups);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid group ID');
    }

    const group = await this.groupModel.findById(id).populate(this.groupPopulate).exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return serializeResource(group);
  }

  async update(id: string, dto: UpdateGroupDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid group ID');
    }

    const updated = await this.groupModel
      .findByIdAndUpdate(id, this.normalizePayload(dto), { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Group not found');
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid group ID');
    }

    const deleted = await this.groupModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Group not found');
    }

    return true;
  }
}
