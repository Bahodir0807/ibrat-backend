import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Statistic, StatisticDocument } from './schemas/statistic.schema';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { StatisticsListQueryDto } from './dto/statistics-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { Role } from '../roles/roles.enum';
import { ensureActorBranchScope, isBranchAdminRole, isSystemWideRole } from '../common/access/actor-scope';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { mapStatisticResponse, mapStatisticResponses } from './dto/statistic-response.dto';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Statistic.name) private statisticModel: Model<StatisticDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private metadataValue(statistic: StatisticDocument, key: string): string | undefined {
    const metadata = statistic.metadata as Map<string, unknown> | Record<string, unknown> | undefined;
    if (!metadata) {
      return undefined;
    }

    const value = metadata instanceof Map ? metadata.get(key) : metadata[key];
    return value === undefined || value === null ? undefined : String(value);
  }

  private buildFilter(query: StatisticsListQueryDto = {}): FilterQuery<StatisticDocument> {
    const filter: FilterQuery<StatisticDocument> = {};

    if (query.type?.trim()) {
      filter.type = query.type.trim();
    }

    if (query.branchId?.trim()) {
      filter['metadata.branchId'] = query.branchId.trim();
    }

    if (query.teacherId?.trim()) {
      filter['metadata.teacherId'] = query.teacherId.trim();
    }

    if (query.studentId?.trim()) {
      filter['metadata.studentId'] = query.studentId.trim();
    }

    if (query.groupId?.trim()) {
      filter['metadata.groupId'] = query.groupId.trim();
    }

    return filter;
  }

  private async getTeacherGroupIds(teacherId: string): Promise<string[]> {
    const groups = await this.groupModel.find({ teacher: teacherId }, { _id: 1 }).lean().exec();
    return groups.map(group => String(group._id));
  }

  private async getTeacherStudentIds(teacherId: string): Promise<string[]> {
    const groups = await this.groupModel.find({ teacher: teacherId }, { students: 1 }).lean().exec();
    const studentIds = new Set<string>();
    for (const group of groups) {
      for (const studentId of group.students ?? []) {
        studentIds.add(String(studentId));
      }
    }

    return [...studentIds];
  }

  private async assertMetadataUsersWithinBranch(
    metadata: Record<string, unknown>,
    actorBranches: string[],
  ): Promise<void> {
    const userIds = ['teacherId', 'studentId']
      .map(key => metadata[key])
      .filter((value): value is string => typeof value === 'string' && Types.ObjectId.isValid(value));

    if (userIds.length > 0) {
      const users = await this.userModel.find({ _id: { $in: userIds } }, { branchIds: 1 }).lean().exec();
      if (
        users.length !== userIds.length
        || users.some(user => !(user.branchIds ?? []).some(branchId => actorBranches.includes(branchId)))
      ) {
        throw new ForbiddenException('Statistic metadata references users outside your branch');
      }
    }

    const groupId = typeof metadata.groupId === 'string' ? metadata.groupId : undefined;
    if (!groupId || !Types.ObjectId.isValid(groupId)) {
      return;
    }

    const group = await this.groupModel.findById(groupId, { teacher: 1, students: 1 }).lean().exec();
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const groupUserIds = [String(group.teacher), ...(group.students ?? []).map(student => String(student))];
    const groupUsers = await this.userModel.find({ _id: { $in: groupUserIds } }, { branchIds: 1 }).lean().exec();
    if (
      groupUsers.length !== groupUserIds.length
      || groupUsers.some(user => !(user.branchIds ?? []).some(branchId => actorBranches.includes(branchId)))
    ) {
      throw new ForbiddenException('Statistic metadata references a group outside your branch');
    }
  }

  private async buildActorFilter(
    query: StatisticsListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<FilterQuery<StatisticDocument>> {
    const baseFilter = this.buildFilter(query);

    if (isSystemWideRole(actor.role)) {
      return baseFilter;
    }

    if (isBranchAdminRole(actor.role)) {
      const actorBranches = ensureActorBranchScope(actor);
      if (query.branchId && !actorBranches.includes(query.branchId)) {
        throw new ForbiddenException('Requested branch is outside your scope');
      }

      return {
        ...baseFilter,
        'metadata.branchId': query.branchId ?? { $in: actorBranches },
      };
    }

    if (actor.role === Role.Teacher) {
      const groupIds = await this.getTeacherGroupIds(actor.userId);
      const actorScope: FilterQuery<StatisticDocument>[] = [
        { 'metadata.teacherId': actor.userId },
      ];
      if (groupIds.length > 0) {
        actorScope.push({ 'metadata.groupId': { $in: groupIds } });
      }

      return { $and: [baseFilter, { $or: actorScope }] };
    }

    if (actor.role === Role.Student) {
      return { ...baseFilter, 'metadata.studentId': actor.userId };
    }

    throw new ForbiddenException('You are not allowed to access statistics');
  }

  private async assertStatisticInActorScope(id: string, actor: AuthenticatedUser): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid statistic ID');
    }

    const statistic = await this.statisticModel.findById(id).exec();
    if (!statistic) {
      throw new NotFoundException('Statistic not found');
    }

    if (isSystemWideRole(actor.role)) {
      return;
    }

    if (isBranchAdminRole(actor.role)) {
      const branchId = this.metadataValue(statistic, 'branchId');
      if (!branchId || !ensureActorBranchScope(actor).includes(branchId)) {
        throw new NotFoundException('Statistic not found');
      }
      return;
    }

    if (actor.role === Role.Teacher) {
      const teacherId = this.metadataValue(statistic, 'teacherId');
      const groupId = this.metadataValue(statistic, 'groupId');
      const groupIds = groupId ? await this.getTeacherGroupIds(actor.userId) : [];
      if (teacherId !== actor.userId && (!groupId || !groupIds.includes(groupId))) {
        throw new NotFoundException('Statistic not found');
      }
      return;
    }

    if (actor.role === Role.Student && this.metadataValue(statistic, 'studentId') === actor.userId) {
      return;
    }

    throw new NotFoundException('Statistic not found');
  }

  private async assertStatisticPayloadWithinActorScope(
    dto: CreateStatisticDto,
    actor: AuthenticatedUser,
  ): Promise<CreateStatisticDto> {
    if (isSystemWideRole(actor.role)) {
      return dto;
    }

    const metadata = { ...(dto.metadata ?? {}) };

    if (isBranchAdminRole(actor.role)) {
      const actorBranches = ensureActorBranchScope(actor);
      const branchId = typeof metadata.branchId === 'string' ? metadata.branchId : undefined;
      if (!branchId && actorBranches.length === 1) {
        metadata.branchId = actorBranches[0];
      } else if (!branchId || !actorBranches.includes(branchId)) {
        throw new ForbiddenException('Statistics must be scoped to your branch');
      }

      await this.assertMetadataUsersWithinBranch(metadata, actorBranches);

      return { ...dto, metadata };
    }

    if (actor.role === Role.Teacher) {
      const groupId = typeof metadata.groupId === 'string' ? metadata.groupId : undefined;
      if (groupId) {
        const groupIds = await this.getTeacherGroupIds(actor.userId);
        if (!groupIds.includes(groupId)) {
          throw new ForbiddenException('Teachers can create statistics only for their own groups');
        }
      }
      const studentId = typeof metadata.studentId === 'string' ? metadata.studentId : undefined;
      if (studentId) {
        const studentIds = await this.getTeacherStudentIds(actor.userId);
        if (!studentIds.includes(studentId)) {
          throw new ForbiddenException('Teachers can create statistics only for students they teach');
        }
      }
      delete metadata.branchId;
      metadata.teacherId = actor.userId;
      return { ...dto, metadata };
    }

    if (actor.role === Role.Student) {
      delete metadata.branchId;
      delete metadata.teacherId;
      delete metadata.groupId;
      metadata.studentId = actor.userId;
      return { ...dto, metadata };
    }

    throw new ForbiddenException('You are not allowed to create statistics');
  }

  private async assertStatisticUpdatePayloadWithinActorScope(
    dto: { metadata?: Record<string, unknown> },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (!dto.metadata || isSystemWideRole(actor.role)) {
      return;
    }

    if (isBranchAdminRole(actor.role)) {
      const branchId = typeof dto.metadata.branchId === 'string' ? dto.metadata.branchId : undefined;
      const actorBranches = ensureActorBranchScope(actor);
      if (!branchId || !actorBranches.includes(branchId)) {
        throw new ForbiddenException('Statistics must remain scoped to your branch');
      }
      await this.assertMetadataUsersWithinBranch(dto.metadata, actorBranches);
      return;
    }

    throw new ForbiddenException('You are not allowed to change statistic metadata');
  }

  async create(dto: CreateStatisticDto) {
    const created = new this.statisticModel({
      ...dto,
      date: new Date(dto.date),
    });
    return mapStatisticResponse(await created.save());
  }

  async createForActor(dto: CreateStatisticDto, actor: AuthenticatedUser) {
    return this.create(await this.assertStatisticPayloadWithinActorScope(dto, actor));
  }

  async findAll(query: StatisticsListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);

    const [statistics, total] = await Promise.all([
      this.statisticModel.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.statisticModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(mapStatisticResponses(statistics), total, page, limit);
  }

  async findByType(type: string, query: StatisticsListQueryDto = {}) {
    return this.findAll({ ...query, type });
  }

  async findAllForActor(query: StatisticsListQueryDto = {}, actor: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = await this.buildActorFilter(query, actor);

    const [statistics, total] = await Promise.all([
      this.statisticModel.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.statisticModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(mapStatisticResponses(statistics), total, page, limit);
  }

  async findByTypeForActor(type: string, query: StatisticsListQueryDto = {}, actor: AuthenticatedUser) {
    return this.findAllForActor({ ...query, type }, actor);
  }

  async updateForActor(id: string, dto: { value?: number; metadata?: Record<string, unknown> }, actor: AuthenticatedUser) {
    await this.assertStatisticInActorScope(id, actor);
    await this.assertStatisticUpdatePayloadWithinActorScope(dto, actor);
    const updated = await this.statisticModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException('Statistic not found');
    }

    await this.assertStatisticInActorScope(id, actor);
    return mapStatisticResponse(updated);
  }

  async removeForActor(id: string, actor: AuthenticatedUser) {
    await this.assertStatisticInActorScope(id, actor);
    const deleted = await this.statisticModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Statistic not found');
    }

    return true;
  }
}
