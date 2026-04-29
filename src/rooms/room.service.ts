import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { RoomsListQueryDto } from './dto/rooms-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
  ) {}

  private getSort(query: RoomsListQueryDto) {
    const sortBy = query.sortBy && ['name', 'capacity', 'type'].includes(query.sortBy)
      ? query.sortBy
      : 'name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  async create(dto: CreateRoomDto) {
    const room = await this.roomModel.create(dto);
    return serializeResource(room);
  }

  async findAll(query: RoomsListQueryDto = {}) {
    const filter: FilterQuery<RoomDocument> = {};

    if (query.type) {
      filter.type = query.type;
    }

    if (typeof query.isAvailable === 'boolean') {
      filter.isAvailable = query.isAvailable;
    }

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { name: regex },
        { description: regex },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rooms, total] = await Promise.all([
      this.roomModel
        .find(filter)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.roomModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(rooms), total, page, limit);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid room ID');
    }

    const room = await this.roomModel.findById(id).exec();
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return serializeResource(room);
  }

  async update(id: string, dto: UpdateRoomDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid room ID');
    }

    const updated = await this.roomModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException('Room not found');
    }

    return serializeResource(updated);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid room ID');
    }

    const scheduleExists = await this.scheduleModel.exists({ room: id }).exec();
    if (scheduleExists) {
      throw new BadRequestException('Room cannot be deleted while schedule entries reference it');
    }

    const deleted = await this.roomModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Room not found');
    }

    return true;
  }
}
