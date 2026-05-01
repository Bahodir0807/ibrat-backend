import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Room, RoomDocument } from './schemas/room.schema';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { RoomsListQueryDto } from './dto/rooms-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { Role } from '../roles/roles.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ensureActorBranchScope, isBranchAdminRole, isSystemWideRole, toObjectIds } from '../common/access/actor-scope';

@Injectable()
export class RoomService {
  constructor(
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private getSort(query: RoomsListQueryDto) {
    const sortBy = query.sortBy && ['name', 'capacity', 'type'].includes(query.sortBy)
      ? query.sortBy
      : 'name';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  private assertCanMutateGlobalRoom(actor: AuthenticatedUser): void {
    if (!isSystemWideRole(actor.role)) {
      throw new ForbiddenException('Rooms are global resources and can be managed only by system-wide roles');
    }
  }

  private buildFilter(query: RoomsListQueryDto = {}): FilterQuery<RoomDocument> {
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

    return filter;
  }

  private async getVisibleRoomIdsForActor(actor: AuthenticatedUser): Promise<string[]> {
    if (isSystemWideRole(actor.role)) {
      return [];
    }

    if (actor.role === Role.Teacher) {
      const schedules = await this.scheduleModel
        .find({ teacher: actor.userId }, { room: 1 })
        .lean()
        .exec();
      return [...new Set(schedules.map(schedule => String(schedule.room)))];
    }

    if (isBranchAdminRole(actor.role)) {
      const actorBranches = ensureActorBranchScope(actor);
      const scopedUsers = await this.userModel
        .find({ branchIds: { $in: actorBranches }, role: { $in: [Role.Teacher, Role.Student] } }, { _id: 1 })
        .lean()
        .exec();
      const scopedUserIds = scopedUsers.map(user => String(user._id));
      if (scopedUserIds.length === 0) {
        return [];
      }

      const scopedObjectIds = toObjectIds(scopedUserIds);
      const schedules = await this.scheduleModel
        .find(
          {
            $or: [
              { teacher: { $in: scopedObjectIds } },
              { students: { $in: scopedObjectIds } },
            ],
          },
          { room: 1 },
        )
        .lean()
        .exec();
      return [...new Set(schedules.map(schedule => String(schedule.room)))];
    }

    return [];
  }

  async create(dto: CreateRoomDto) {
    const room = await this.roomModel.create(dto);
    return serializeResource(room);
  }

  async findAll(query: RoomsListQueryDto = {}) {
    const filter = this.buildFilter(query);

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

  async createForActor(dto: CreateRoomDto, actor: AuthenticatedUser) {
    this.assertCanMutateGlobalRoom(actor);
    return this.create(dto);
  }

  async findAllForActor(query: RoomsListQueryDto = {}, actor: AuthenticatedUser) {
    if (isSystemWideRole(actor.role)) {
      return this.findAll(query);
    }

    const roomIds = await this.getVisibleRoomIdsForActor(actor);
    if (roomIds.length === 0) {
      return createPaginatedResult([], 0, query.page ?? 1, query.limit ?? 20);
    }

    const filter = this.buildFilter(query);
    filter._id = { $in: toObjectIds(roomIds) };
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

  async findByIdForActor(id: string, actor: AuthenticatedUser) {
    const room = await this.findById(id);
    if (isSystemWideRole(actor.role)) {
      return room;
    }

    const roomIds = await this.getVisibleRoomIdsForActor(actor);
    if (!roomIds.includes(id)) {
      throw new NotFoundException('Room not found');
    }

    return room;
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

  async updateForActor(id: string, dto: UpdateRoomDto, actor: AuthenticatedUser) {
    this.assertCanMutateGlobalRoom(actor);
    await this.findById(id);
    return this.update(id, dto);
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

  async removeForActor(id: string, actor: AuthenticatedUser) {
    this.assertCanMutateGlobalRoom(actor);
    await this.findById(id);
    return this.remove(id);
  }
}
