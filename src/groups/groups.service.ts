import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { Group, GroupDocument } from './schemas/group.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { GroupsListQueryDto } from './dto/groups-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../roles/roles.enum';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
  ) {}

  private readonly groupPopulate = [
    { path: 'course', select: 'name description price teacherId students' },
    { path: 'teacher', select: 'username firstName lastName role email phoneNumber' },
    { path: 'students', select: 'username firstName lastName role email phoneNumber' },
  ];

  private extractReferenceId(value: unknown): string {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
      return String((value as { id: unknown }).id);
    }

    return String(value ?? '');
  }

  private assertTeacherCanManageGroup(group: { teacher?: unknown }, actor: AuthenticatedUser) {
    if (actor.role !== Role.Teacher) {
      return;
    }

    if (String(group.teacher ?? '') !== actor.userId) {
      throw new ForbiddenException('Teachers can manage only their own groups');
    }
  }

  private assertActorCanReadGroup(
    group: { teacher?: unknown; students?: unknown[] },
    actor: AuthenticatedUser,
  ) {
    if ([Role.Admin, Role.Owner, Role.Extra].includes(actor.role)) {
      return;
    }

    if (actor.role === Role.Teacher) {
      if (this.extractReferenceId(group.teacher) !== actor.userId) {
        throw new ForbiddenException('Teachers can access only their own groups');
      }

      return;
    }

    if (actor.role === Role.Student) {
      const students = Array.isArray(group.students) ? group.students : [];
      const isMember = students.some(student => this.extractReferenceId(student) === actor.userId);
      if (!isMember) {
        throw new ForbiddenException('Students can access only their own groups');
      }
    }
  }

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

  private async validateRelations(payload: Record<string, unknown>) {
    const courseId = payload.course ? String(payload.course) : undefined;
    const teacherId = payload.teacher ? String(payload.teacher) : undefined;

    if (courseId) {
      const course = await this.courseModel.findById(courseId).lean().exec();
      if (!course) {
        throw new NotFoundException('Course not found');
      }

      if (teacherId && course.teacherId && String(course.teacherId) !== teacherId) {
        throw new BadRequestException('Group teacher must match the related course teacher');
      }
    }

    if (teacherId) {
      const teacher = await this.userModel.findById(teacherId).lean().exec();
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      if (teacher.role !== Role.Teacher) {
        throw new BadRequestException('Assigned teacher must have teacher role');
      }
    }

    if (payload.students && Array.isArray(payload.students) && payload.students.length > 0) {
      const students = await this.userModel.find({ _id: { $in: payload.students } }).lean().exec();
      if (students.length !== payload.students.length) {
        throw new NotFoundException('One or more students were not found');
      }

      const invalidStudent = students.find(student => student.role !== Role.Student);
      if (invalidStudent) {
        throw new BadRequestException('Only users with student role can be assigned to a group');
      }
    }
  }

  async create(dto: CreateGroupDto) {
    const payload = this.normalizePayload(dto);
    await this.validateRelations(payload);
    const created = await this.groupModel.create(payload);
    return this.findOne(String(created._id));
  }

  async createForActor(dto: CreateGroupDto, actor: AuthenticatedUser) {
    const payload = { ...dto };

    if (actor.role === Role.Teacher) {
      if (payload.teacher && payload.teacher !== actor.userId) {
        throw new ForbiddenException('Teachers can create groups only for themselves');
      }

      payload.teacher = actor.userId;
    }

    return this.create(payload);
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

    const [groups, total] = await Promise.all([
      this.groupModel
        .find(filter)
        .populate(this.groupPopulate)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.groupModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(groups), total, page, limit);
  }

  async findAllForActor(query: GroupsListQueryDto, actor: AuthenticatedUser) {
    if (actor.role === Role.Teacher) {
      return this.findAll({ ...query, teacherId: actor.userId });
    }

    if (actor.role === Role.Student) {
      return this.findAll({ ...query, studentId: actor.userId });
    }

    return this.findAll(query);
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

  async findOneForActor(id: string, actor: AuthenticatedUser) {
    const group = await this.findOne(id);
    this.assertActorCanReadGroup(group as { teacher?: unknown; students?: unknown[] }, actor);
    return group;
  }

  async update(id: string, dto: UpdateGroupDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid group ID');
    }

    const payload = this.normalizePayload(dto);
    await this.validateRelations(payload);

    const updated = await this.groupModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Group not found');
    }

    return this.findOne(id);
  }

  async updateForActor(id: string, dto: UpdateGroupDto, actor: AuthenticatedUser) {
    const payload = { ...dto };

    if (actor.role === Role.Teacher) {
      const group = await this.findDocumentById(id);
      if (!group) {
        throw new ForbiddenException('Group not found or access denied');
      }

      this.assertTeacherCanManageGroup(group, actor);

      if (payload.teacher && payload.teacher !== actor.userId) {
        throw new ForbiddenException('Teachers cannot reassign groups to another teacher');
      }

      payload.teacher = actor.userId;
    }

    return this.update(id, payload);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid group ID');
    }

    const scheduleExists = await this.scheduleModel.exists({ group: id }).exec();
    if (scheduleExists) {
      throw new BadRequestException('Group cannot be deleted while schedule entries reference it');
    }

    const deleted = await this.groupModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Group not found');
    }

    return true;
  }
}
