import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/shedule.schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { ScheduleListQueryDto } from './dto/schedule-list-query.dto';
import { Role } from '../roles/roles.enum';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name) private readonly schModel: Model<ScheduleDocument>,
  ) {}

  private readonly schedulePopulate = [
    { path: 'course', select: 'name description price teacherId students' },
    { path: 'teacher', select: 'username firstName lastName role email phoneNumber' },
    { path: 'students', select: 'username firstName lastName role email phoneNumber' },
    { path: 'room', select: 'name capacity type isAvailable description' },
    { path: 'group', select: 'name course teacher students' },
  ];

  async findDocumentById(id: string): Promise<ScheduleDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.schModel.findById(id).exec();
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

  private normalizePayload(dto: CreateScheduleDto | UpdateScheduleDto) {
    const payload: Record<string, unknown> = { ...dto };

    if ('course' in dto && dto.course !== undefined) {
      payload.course = this.toObjectId(dto.course);
    }

    if ('room' in dto && dto.room !== undefined) {
      payload.room = this.toObjectId(dto.room);
    }

    if ('teacher' in dto && dto.teacher !== undefined) {
      payload.teacher = this.toObjectId(dto.teacher);
    }

    if ('group' in dto && dto.group !== undefined) {
      payload.group = dto.group ? this.toObjectId(dto.group) : undefined;
    }

    if ('students' in dto && dto.students !== undefined) {
      payload.students = Array.from(
        new Set((dto.students ?? []).map(studentId => this.toObjectId(studentId)!.toString())),
      ).map(studentId => new Types.ObjectId(studentId));
    }

    return payload;
  }

  private buildFilter(query: ScheduleListQueryDto = {}): FilterQuery<ScheduleDocument> {
    const filter: FilterQuery<ScheduleDocument> = {};

    if (query.teacherId) {
      filter.teacher = this.toObjectId(query.teacherId);
    }

    if (query.groupId) {
      filter.group = this.toObjectId(query.groupId);
    }

    if (query.courseId) {
      filter.course = this.toObjectId(query.courseId);
    }

    if (query.studentId) {
      filter.students = this.toObjectId(query.studentId);
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};

      if (query.from) {
        dateFilter.$gte = new Date(query.from);
      }

      if (query.to) {
        dateFilter.$lte = new Date(query.to);
      }

      filter.date = dateFilter;
    }

    return filter;
  }

  private getSort(query: ScheduleListQueryDto) {
    const sortBy = query.sortBy && ['date', 'timeStart', 'createdAt'].includes(query.sortBy)
      ? query.sortBy
      : 'date';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    return sortBy === 'date'
      ? { date: sortOrder as SortOrder, timeStart: sortOrder as SortOrder }
      : { [sortBy]: sortOrder as SortOrder };
  }

  async getScheduleForUser(userId: string, role: string) {
    if (role === Role.Student) {
      return this.findAll({ studentId: userId, sortBy: 'date', sortOrder: 'asc', limit: 100 });
    }

    if (role === Role.Teacher) {
      return this.findAll({ teacherId: userId, sortBy: 'date', sortOrder: 'asc', limit: 100 });
    }

    if ([Role.Admin, Role.Owner, Role.Extra].includes(role as Role)) {
      return this.findAll({ sortBy: 'date', sortOrder: 'asc', limit: 100 });
    }

    throw new ForbiddenException('No access to schedule');
  }

  async getScheduleByUserId(userId: string) {
    const schedule = await this.schModel
      .find({
        $or: [
          { teacher: this.toObjectId(userId) },
          { students: this.toObjectId(userId) },
        ],
      })
      .populate(this.schedulePopulate)
      .sort({ date: 1, timeStart: 1 })
      .limit(100)
      .exec();

    return serializeResources(schedule);
  }

  async findAll(query: ScheduleListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const schedule = await this.schModel
      .find(this.buildFilter(query))
      .populate(this.schedulePopulate)
      .sort(this.getSort(query))
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return serializeResources(schedule);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const schedule = await this.schModel.findById(id).populate(this.schedulePopulate).exec();
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return serializeResource(schedule);
  }

  async create(createScheduleDto: CreateScheduleDto) {
    const schedule = await this.schModel.create(this.normalizePayload(createScheduleDto));
    return this.findOne(String(schedule._id));
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const updated = await this.schModel
      .findByIdAndUpdate(id, this.normalizePayload(updateScheduleDto), { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Schedule not found');
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const deleted = await this.schModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Schedule not found');
    }

    return true;
  }
}
