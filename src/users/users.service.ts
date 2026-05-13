import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, UpdateQuery } from 'mongoose';
import { randomUUID } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../roles/roles.enum';
import {
  hashPassword,
  verifyPassword as comparePassword,
} from '../common/password';
import { PublicUser } from './types/public-user.type';
import { UsersListQueryDto } from './dto/users-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  Schedule,
  ScheduleDocument,
} from '../schedule/schemas/schedule.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  Attendance,
  AttendanceDocument,
} from '../attendance/schemas/attendance.schema';
import {
  Homework,
  HomeworkDocument,
} from '../homework/schemas/homework.schema';
import { Grade, GradeDocument } from '../grades/schemas/grade.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserStatus } from './user-status.enum';
import {
  canAuthenticateWithStatus,
  resolveUserStatus,
  statusToIsActive,
} from './user-status';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  mapPublicUserResponse,
  mapUserResponse,
} from './dto/user-response.dto';

type ContactAliasPayload = {
  phoneNumber?: string | null;
  phone?: string | null;
  telephone?: string | null;
};

type NormalizedContactPayload<T extends object> = Omit<
  T,
  'phone' | 'telephone'
> & {
  phoneNumber?: string | null;
};

@Injectable()
export class UsersService {
  private readonly clearableProfileFields = new Set<keyof User>([
    'email',
    'phoneNumber',
    'telegramId',
    'avatarUrl',
  ]);

  constructor(
    private readonly usersRepository: UsersRepository,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Homework.name)
    private readonly homeworkModel: Model<HomeworkDocument>,
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
  ) {}

  private getResolvedStatus(
    user: Pick<User, 'status' | 'isActive'>,
  ): UserStatus {
    return resolveUserStatus(user);
  }

  private sanitizeUser(user: UserDocument): PublicUser {
    const obj = user.toObject() as User & {
      _id?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };
    const status = this.getResolvedStatus(obj);

    return {
      id: String(user._id),
      username: obj.username,
      telegramId: obj.telegramId,
      firstName: obj.firstName ?? '',
      lastName: obj.lastName ?? '',
      role: obj.role,
      status,
      isActive: statusToIsActive(status),
      avatarUrl: obj.avatarUrl,
      branchIds: this.normalizeBranchIds(obj.branchIds),
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  private normalizeBranchIds(branchIds?: string[]): string[] {
    return [
      ...new Set(
        (branchIds ?? [])
          .filter(
            (branchId): branchId is string => typeof branchId === 'string',
          )
          .map((branchId) => branchId.trim())
          .filter((branchId) => branchId.length > 0),
      ),
    ];
  }

  private isSystemWideRole(role?: Role): boolean {
    return role === Role.Owner || role === Role.Admin || role === Role.Extra;
  }

  private removeEmptyOptionalProfileFields<T extends Partial<User>>(
    payload: T,
  ): T {
    const normalized = { ...payload };

    for (const field of this.clearableProfileFields) {
      if (
        normalized[field] === null ||
        normalized[field] === undefined ||
        normalized[field] === ''
      ) {
        delete normalized[field];
      }
    }

    return normalized;
  }

  private normalizeContactAliases<T extends object>(
    payload: T,
  ): NormalizedContactPayload<T> {
    const normalized = { ...payload } as T & ContactAliasPayload;
    const hasPhoneNumber = Object.prototype.hasOwnProperty.call(
      normalized,
      'phoneNumber',
    );
    const hasPhone = Object.prototype.hasOwnProperty.call(normalized, 'phone');
    const hasTelephone = Object.prototype.hasOwnProperty.call(
      normalized,
      'telephone',
    );

    if (!hasPhoneNumber && (hasPhone || hasTelephone)) {
      normalized.phoneNumber = hasPhone
        ? normalized.phone
        : normalized.telephone;
    }

    delete normalized.phone;
    delete normalized.telephone;

    return normalized;
  }

  private buildUserUpdate(payload: Partial<User>): UpdateQuery<UserDocument> {
    const setPayload: Partial<User> = {};
    const unsetPayload: Record<string, ''> = {};

    for (const [key, value] of Object.entries(payload) as Array<
      [keyof User, unknown]
    >) {
      if (
        this.clearableProfileFields.has(key) &&
        (value === null || value === undefined || value === '')
      ) {
        unsetPayload[key] = '';
        continue;
      }

      if (value === null || value === undefined) {
        continue;
      }

      (setPayload as Record<string, unknown>)[key] = value;
    }

    const update: UpdateQuery<UserDocument> = {};
    if (Object.keys(setPayload).length > 0) {
      update.$set = setPayload;
    }
    if (Object.keys(unsetPayload).length > 0) {
      update.$unset = unsetPayload;
    }

    return Object.keys(update).length > 0 ? update : { $set: {} };
  }

  private mapUserResponseForActor(
    user: UserDocument,
    actor: AuthenticatedUser,
  ) {
    const sanitized = this.sanitizeUser(user);
    return (
      this.isSystemWideRole(actor.role)
        ? mapUserResponse(sanitized)
        : mapPublicUserResponse(sanitized)
    ) as PublicUser;
  }

  private mapUserResponsesForActor(
    users: UserDocument[],
    actor: AuthenticatedUser,
  ) {
    return users.map((user) => this.mapUserResponseForActor(user, actor));
  }

  private isBranchAdminRole(role?: Role): boolean {
    return false;
  }

  private getActorBranchScope(actor?: AuthenticatedUser): string[] {
    return this.normalizeBranchIds(actor?.branchIds);
  }

  private ensureScopedActorHasBranches(actor: AuthenticatedUser): string[] {
    const branchIds = this.getActorBranchScope(actor);
    if (!this.isSystemWideRole(actor.role) && branchIds.length === 0) {
      throw new ForbiddenException('User has no assigned branch scope');
    }

    return branchIds;
  }

  private hasBranchOverlap(
    actorBranchIds: string[],
    targetBranchIds?: string[],
  ): boolean {
    const normalizedTarget = this.normalizeBranchIds(targetBranchIds);
    return normalizedTarget.some((branchId) =>
      actorBranchIds.includes(branchId),
    );
  }

  private assertActorCanReadUser(
    actor: AuthenticatedUser,
    targetUser: Pick<UserDocument, '_id' | 'role' | 'branchIds'>,
  ): void {
    if (this.isSystemWideRole(actor.role)) {
      return;
    }

    if (actor.userId === String(targetUser._id)) {
      return;
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      if (this.hasBranchOverlap(actorBranches, targetUser.branchIds)) {
        return;
      }
    }

    throw new NotFoundException('User not found');
  }

  private assertActorCanManageTarget(
    actor: AuthenticatedUser,
    targetUser: Pick<UserDocument, '_id' | 'role' | 'branchIds'>,
  ): void {
    if (this.isSystemWideRole(actor.role)) {
      this.assertCanManageTarget(actor.role, targetUser.role);
      return;
    }

    if (this.isBranchAdminRole(actor.role)) {
      this.assertCanManageTarget(actor.role, targetUser.role);
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      if (!this.hasBranchOverlap(actorBranches, targetUser.branchIds)) {
        throw new NotFoundException('User not found');
      }
      return;
    }

    throw new ForbiddenException('You are not allowed to manage users');
  }

  private assertActorCanAssignBranches(
    actor: AuthenticatedUser,
    branchIds: string[],
  ): string[] {
    const normalizedBranchIds = this.normalizeBranchIds(branchIds);

    if (!this.isBranchAdminRole(actor.role)) {
      return normalizedBranchIds;
    }

    const actorBranches = this.ensureScopedActorHasBranches(actor);
    if (normalizedBranchIds.length === 0) {
      throw new BadRequestException(
        'Branch-scoped users must remain assigned to at least one branch',
      );
    }

    if (
      !normalizedBranchIds.every((branchId) => actorBranches.includes(branchId))
    ) {
      throw new ForbiddenException(
        'Branch admin can assign only users within their branch scope',
      );
    }

    return normalizedBranchIds;
  }

  private resolveCreateBranchIds(
    dto: CreateUserDto,
    actor?: AuthenticatedUser,
  ): string[] {
    const inputBranchIds = this.normalizeBranchIds(dto.branchIds);

    if (actor && this.isBranchAdminRole(actor.role)) {
      if (inputBranchIds.length === 0) {
        return this.ensureScopedActorHasBranches(actor);
      }

      return this.assertActorCanAssignBranches(actor, inputBranchIds);
    }

    return inputBranchIds;
  }

  private buildBranchScopedFilter(
    filter: FilterQuery<UserDocument>,
    queryBranchId: string | undefined,
    actor?: AuthenticatedUser,
  ): FilterQuery<UserDocument> {
    if (!actor || this.isSystemWideRole(actor.role)) {
      if (queryBranchId) {
        return { ...filter, branchIds: queryBranchId };
      }

      return filter;
    }

    const actorBranches = this.ensureScopedActorHasBranches(actor);
    if (queryBranchId) {
      if (!actorBranches.includes(queryBranchId)) {
        throw new ForbiddenException('Requested branch is outside your scope');
      }

      return { ...filter, branchIds: queryBranchId };
    }

    return { ...filter, branchIds: { $in: actorBranches } };
  }

  private assertRoleSpecificBranchRequirements(
    role: Role,
    branchIds: string[],
  ): void {
    return;
  }

  private async getTeacherVisibleStudentIds(
    teacherId: string,
  ): Promise<string[]> {
    const [courses, groups, schedules] = await Promise.all([
      this.courseModel
        .find(
          { $or: [{ teacherIds: teacherId }, { teacherId }] },
          { students: 1 },
        )
        .lean()
        .exec(),
      this.groupModel
        .find({ teacher: teacherId }, { students: 1 })
        .lean()
        .exec(),
      this.scheduleModel
        .find({ teacher: teacherId }, { students: 1 })
        .lean()
        .exec(),
    ]);

    const studentIds = new Set<string>();
    for (const collection of [courses, groups, schedules]) {
      for (const item of collection) {
        const students = Array.isArray(item.students) ? item.students : [];
        for (const studentId of students) {
          studentIds.add(String(studentId));
        }
      }
    }

    return [...studentIds];
  }

  private getAssignableRoles(actorRole?: Role): Role[] {
    if ([Role.Owner, Role.Admin, Role.Extra].includes(actorRole as Role)) {
      return [
        Role.Owner,
        Role.Admin,
        Role.Extra,
        Role.Teacher,
        Role.Student,
        Role.Guest,
      ];
    }

    return [Role.Student, Role.Guest];
  }

  private assertRoleCanBeAssigned(
    actorRole: Role | undefined,
    desiredRole: Role,
  ) {
    if (!this.getAssignableRoles(actorRole).includes(desiredRole)) {
      throw new ForbiddenException('You are not allowed to assign this role');
    }
  }

  private assertCanManageTarget(actorRole: Role, targetRole: Role) {
    if ([Role.Owner, Role.Admin, Role.Extra].includes(actorRole)) {
      return;
    }
    throw new ForbiddenException('You are not allowed to manage users');
  }

  private async ensureUniqueFields(
    dto: Partial<CreateUserDto>,
    excludeId?: string,
  ): Promise<void> {
    const checks: Array<[keyof CreateUserDto, unknown]> = [
      ['username', dto.username],
      ['email', dto.email],
      ['phoneNumber', dto.phoneNumber],
      ['telegramId', dto.telegramId],
    ];

    for (const [field, value] of checks) {
      if (!value) {
        continue;
      }

      const existing = await this.usersRepository
        .findOne({
          [field]: value,
          ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        })
        .lean()
        .exec();

      if (existing) {
        throw new ConflictException(`${String(field)} is already in use`);
      }
    }
  }

  private async ensureLastOwnerRoleIsProtected(
    targetUserId: string,
    nextRole?: Role,
  ): Promise<void> {
    const existingUser = await this.usersRepository
      .findById(targetUserId)
      .lean()
      .exec();

    if (!existingUser || existingUser.role !== Role.Owner) {
      return;
    }

    if (nextRole === undefined || nextRole === Role.Owner) {
      return;
    }

    const ownersCount = await this.usersRepository
      .countDocuments({ role: Role.Owner })
      .exec();
    if (ownersCount <= 1) {
      throw new ConflictException(
        'At least one owner must remain active in the system',
      );
    }
  }

  private async ensureLastOwnerStatusIsProtected(
    targetUserId: string,
    nextStatus: UserStatus,
  ): Promise<void> {
    const existingUser = await this.usersRepository
      .findById(targetUserId)
      .lean()
      .exec();

    if (
      !existingUser ||
      existingUser.role !== Role.Owner ||
      nextStatus === UserStatus.Active
    ) {
      return;
    }

    const activeOwnersCount = await this.usersRepository
      .countDocuments({
        role: Role.Owner,
        $or: [
          { status: UserStatus.Active },
          { status: { $exists: false }, isActive: { $ne: false } },
        ],
      })
      .exec();

    if (activeOwnersCount <= 1) {
      throw new ConflictException(
        'At least one active owner must remain in the system',
      );
    }
  }

  private async ensureUserHasNoReferences(userId: string): Promise<void> {
    const [
      teachesCourses,
      attendsCourses,
      teachesGroups,
      attendsGroups,
      teachesSchedule,
      attendsSchedule,
      payments,
      attendance,
      homework,
      grades,
    ] = await Promise.all([
      this.courseModel
        .exists({ $or: [{ teacherIds: userId }, { teacherId: userId }] })
        .exec(),
      this.courseModel.exists({ students: userId }).exec(),
      this.groupModel.exists({ teacher: userId }).exec(),
      this.groupModel.exists({ students: userId }).exec(),
      this.scheduleModel.exists({ teacher: userId }).exec(),
      this.scheduleModel.exists({ students: userId }).exec(),
      this.paymentModel.exists({ student: userId }).exec(),
      this.attendanceModel.exists({ user: userId }).exec(),
      this.homeworkModel.exists({ user: userId }).exec(),
      this.gradeModel.exists({ user: userId }).exec(),
    ]);

    if (
      teachesCourses ||
      attendsCourses ||
      teachesGroups ||
      attendsGroups ||
      teachesSchedule ||
      attendsSchedule ||
      payments ||
      attendance ||
      homework ||
      grades
    ) {
      throw new BadRequestException(
        'User cannot be deleted while related academic or financial records exist',
      );
    }
  }

  private applyStatusFields<T extends Partial<User>>(payload: T): T {
    if (payload.status) {
      payload.isActive = statusToIsActive(payload.status);
    }

    return payload;
  }

  private normalizeStatusFilter(
    status?: UserStatus,
  ): FilterQuery<UserDocument> | undefined {
    if (!status) {
      return undefined;
    }

    if (status === UserStatus.Active) {
      return {
        $or: [
          { status: UserStatus.Active },
          { status: { $exists: false }, isActive: { $ne: false } },
        ],
      };
    }

    if (status === UserStatus.Inactive) {
      return {
        $or: [
          { status: UserStatus.Inactive },
          { status: { $exists: false }, isActive: false },
        ],
      };
    }

    return { status };
  }

  async findByIdDoc(id: string): Promise<UserDocument | null> {
    return this.usersRepository.findById(id).exec();
  }

  async findByTelegramIdDoc(telegramId: number): Promise<UserDocument | null> {
    return this.usersRepository
      .findOne({ telegramId: String(telegramId) })
      .exec();
  }

  async findByUsernameForAuth(username: string): Promise<UserDocument | null> {
    return this.usersRepository.findOne({ username }).exec();
  }

  async verifyPassword(
    hashedPassword: string,
    plainPassword: string,
  ): Promise<boolean> {
    return comparePassword(plainPassword, hashedPassword);
  }

  async assertPassword(
    userId: string,
    password: string,
  ): Promise<UserDocument> {
    const user = await this.usersRepository.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!canAuthenticateWithStatus(this.getResolvedStatus(user))) {
      throw new UnauthorizedException('User is not allowed to authenticate');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    return user;
  }

  async findAll(query: UsersListQueryDto = {}) {
    const filterParts: FilterQuery<UserDocument>[] = [];

    if (query.role) {
      filterParts.push({ role: query.role });
    }

    const statusFilter = this.normalizeStatusFilter(query.status);
    if (statusFilter) {
      filterParts.push(statusFilter);
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filterParts.push({
        $or: [
          { username: regex },
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { phoneNumber: regex },
        ],
      });
    }

    const filter: FilterQuery<UserDocument> =
      filterParts.length > 1 ? { $and: filterParts } : (filterParts[0] ?? {});

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy =
      query.sortBy &&
      ['username', 'firstName', 'createdAt', 'role', 'status'].includes(
        query.sortBy,
      )
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [users, total] = await Promise.all([
      this.usersRepository
        .find(filter)
        .sort({ [sortBy]: sortOrder as SortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.usersRepository.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(
      users.map((user) => mapUserResponse(this.sanitizeUser(user))),
      total,
      page,
      limit,
    );
  }

  async findAllForActor(
    query: UsersListQueryDto = {},
    actor: AuthenticatedUser,
  ) {
    const filterParts: FilterQuery<UserDocument>[] = [];

    if (query.role) {
      filterParts.push({ role: query.role });
    }

    const statusFilter = this.normalizeStatusFilter(query.status);
    if (statusFilter) {
      filterParts.push(statusFilter);
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filterParts.push({
        $or: [
          { username: regex },
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { phoneNumber: regex },
        ],
      });
    }

    const baseFilter: FilterQuery<UserDocument> =
      filterParts.length > 1 ? { $and: filterParts } : (filterParts[0] ?? {});
    const filter = this.buildBranchScopedFilter(
      baseFilter,
      query.branchId,
      actor,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy =
      query.sortBy &&
      ['username', 'firstName', 'createdAt', 'role', 'status'].includes(
        query.sortBy,
      )
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [users, total] = await Promise.all([
      this.usersRepository
        .find(filter)
        .sort({ [sortBy]: sortOrder as SortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.usersRepository.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(
      this.mapUserResponsesForActor(users, actor),
      total,
      page,
      limit,
    );
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(user));
  }

  async findByIdForActor(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.assertActorCanReadUser(actor, user);

    return this.mapUserResponseForActor(user, actor);
  }

  async findByUsername(username: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findOne({ username }).exec();
    return user ? mapUserResponse(this.sanitizeUser(user)) : null;
  }

  async findByPhone(phoneNumber: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findOne({ phoneNumber }).exec();
    return user ? mapUserResponse(this.sanitizeUser(user)) : null;
  }

  async findByTelegramId(telegramId: number): Promise<PublicUser | null> {
    const user = await this.usersRepository
      .findOne({ telegramId: String(telegramId) })
      .exec();
    return user ? mapUserResponse(this.sanitizeUser(user)) : null;
  }

  async findByRole(role: Role): Promise<PublicUser[]> {
    const users = await this.usersRepository
      .find({ role })
      .sort({ createdAt: -1 })
      .exec();
    return users.map((user) => mapUserResponse(this.sanitizeUser(user)));
  }

  async findByRoleForActor(
    role: Role,
    actor: AuthenticatedUser,
  ): Promise<PublicUser[]> {
    if (this.isSystemWideRole(actor.role)) {
      return this.findByRole(role);
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const users = await this.usersRepository
        .find({ role, branchIds: { $in: actorBranches } })
        .sort({ createdAt: -1 })
        .exec();
      return this.mapUserResponsesForActor(users, actor);
    }

    if (actor.role === Role.Teacher && role === Role.Student) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(
        actor.userId,
      );
      if (visibleStudentIds.length === 0) {
        return [];
      }

      const users = await this.usersRepository
        .find({ _id: { $in: visibleStudentIds }, role: Role.Student })
        .sort({ createdAt: -1 })
        .exec();
      return this.mapUserResponsesForActor(users, actor);
    }

    if (actor.role === Role.Student && role === Role.Student) {
      const user = await this.usersRepository.findById(actor.userId).exec();
      return user ? [this.mapUserResponseForActor(user, actor)] : [];
    }

    throw new ForbiddenException(
      'You are not allowed to access users with this role',
    );
  }

  async findNotificationRecipientForActor(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const user = await this.usersRepository.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (actor.role === Role.Teacher && user.role === Role.Student) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(
        actor.userId,
      );
      if (!visibleStudentIds.includes(String(user._id))) {
        throw new NotFoundException('User not found');
      }

      return mapUserResponse(this.sanitizeUser(user));
    }

    this.assertActorCanReadUser(actor, user);
    return mapUserResponse(this.sanitizeUser(user));
  }

  async create(dto: CreateUserDto, actorRole?: Role): Promise<PublicUser> {
    const normalizedDto = this.normalizeContactAliases(dto);
    await this.ensureUniqueFields(normalizedDto);

    const desiredRole = normalizedDto.role ?? Role.Guest;
    const desiredStatus = normalizedDto.status ?? UserStatus.Active;
    const branchIds = this.normalizeBranchIds(normalizedDto.branchIds);
    const userPayload = this.removeEmptyOptionalProfileFields(normalizedDto);

    this.assertRoleCanBeAssigned(actorRole, desiredRole);
    this.assertRoleSpecificBranchRequirements(desiredRole, branchIds);

    const createdUser = this.usersRepository.create(
      this.applyStatusFields({
        ...userPayload,
        password: await hashPassword(normalizedDto.password),
        role: desiredRole,
        status: desiredStatus,
        branchIds,
      }),
    );

    const savedUser = await createdUser.save();
    return mapUserResponse(this.sanitizeUser(savedUser));
  }

  async createForActor(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const normalizedDto = this.normalizeContactAliases(dto);
    await this.ensureUniqueFields(normalizedDto);

    const desiredRole = normalizedDto.role ?? Role.Guest;
    const desiredStatus = normalizedDto.status ?? UserStatus.Active;
    const userPayload = this.removeEmptyOptionalProfileFields(normalizedDto);

    this.assertRoleCanBeAssigned(actor.role, desiredRole);

    const branchIds = this.resolveCreateBranchIds(normalizedDto, actor);
    this.assertRoleSpecificBranchRequirements(desiredRole, branchIds);

    const createdUser = this.usersRepository.create(
      this.applyStatusFields({
        ...userPayload,
        password: await hashPassword(normalizedDto.password),
        role: desiredRole,
        status: desiredStatus,
        branchIds,
      }),
    );

    const savedUser = await createdUser.save();
    return mapUserResponse(this.sanitizeUser(savedUser));
  }

  async createWithPhone(dto: {
    name: string;
    phone: string;
    telegramId: number;
    role: Role;
  }): Promise<PublicUser> {
    const createdUser = this.usersRepository.create({
      firstName: dto.name,
      lastName: '',
      phoneNumber: dto.phone,
      telegramId: String(dto.telegramId),
      role: dto.role,
      status: UserStatus.Active,
      username: dto.phone,
      isActive: true,
      password: await hashPassword(randomUUID()),
    });

    await this.ensureUniqueFields({
      username: createdUser.username,
      phoneNumber: createdUser.phoneNumber,
      telegramId: createdUser.telegramId,
    });

    const savedUser = await createdUser.save();
    return mapUserResponse(this.sanitizeUser(savedUser));
  }

  async updateOwnProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const normalizedDto = this.normalizeContactAliases(dto);
    await this.ensureUniqueFields(normalizedDto, id);

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, this.buildUserUpdate(normalizedDto), { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async searchForActor(
    query: { username?: string; phone?: string; telegramId?: string },
    actor: AuthenticatedUser,
  ): Promise<PublicUser | null> {
    let user: UserDocument | null = null;

    if (query.username) {
      user = await this.usersRepository
        .findOne({ username: query.username })
        .exec();
    } else if (query.phone) {
      user = await this.usersRepository
        .findOne({ phoneNumber: query.phone })
        .exec();
    } else if (query.telegramId) {
      user = await this.usersRepository
        .findOne({ telegramId: String(query.telegramId) })
        .exec();
    }

    if (!user) {
      return null;
    }

    this.assertActorCanReadUser(actor, user);

    return mapUserResponse(this.sanitizeUser(user));
  }

  async findStudentsForActor(
    query: UsersListQueryDto = {},
    actor: AuthenticatedUser,
  ) {
    const normalizedQuery: UsersListQueryDto = {
      ...query,
      role: Role.Student,
    };

    if (
      this.isSystemWideRole(actor.role) ||
      this.isBranchAdminRole(actor.role)
    ) {
      return this.findAllForActor(normalizedQuery, actor);
    }

    if (actor.role === Role.Teacher) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(
        actor.userId,
      );
      if (visibleStudentIds.length === 0) {
        return createPaginatedResult([], 0, query.page ?? 1, query.limit ?? 20);
      }

      const filterParts: FilterQuery<UserDocument>[] = [{ role: Role.Student }];
      filterParts.push({ _id: { $in: visibleStudentIds } });

      const statusFilter = this.normalizeStatusFilter(query.status);
      if (statusFilter) {
        filterParts.push(statusFilter);
      }

      if (query.search) {
        const regex = new RegExp(query.search.trim(), 'i');
        filterParts.push({
          $or: [
            { username: regex },
            { firstName: regex },
            { lastName: regex },
            { email: regex },
            { phoneNumber: regex },
          ],
        });
      }

      const baseFilter: FilterQuery<UserDocument> =
        filterParts.length > 1 ? { $and: filterParts } : filterParts[0];
      const filter = this.buildBranchScopedFilter(
        baseFilter,
        query.branchId,
        actor,
      );
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const sortBy =
        query.sortBy &&
        ['username', 'firstName', 'createdAt', 'role', 'status'].includes(
          query.sortBy,
        )
          ? query.sortBy
          : 'createdAt';
      const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
      const [users, total] = await Promise.all([
        this.usersRepository
          .find(filter)
          .sort({ [sortBy]: sortOrder as SortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.usersRepository.countDocuments(filter).exec(),
      ]);

      return createPaginatedResult(
        this.mapUserResponsesForActor(users, actor),
        total,
        page,
        limit,
      );
    }

    throw new ForbiddenException('You are not allowed to access students');
  }

  async updateManagedUser(
    id: string,
    dto: UpdateUserDto,
    actorRole: Role,
  ): Promise<PublicUser> {
    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageTarget(actorRole, targetUser.role);

    const normalizedDto = this.normalizeContactAliases(
      dto as UpdateUserDto & { isActive?: boolean },
    );
    const { roleKey, isActive, branchIds, password, ...updatePayload } =
      normalizedDto;
    await this.ensureUniqueFields(updatePayload, id);
    const nextBranchIds = this.normalizeBranchIds(
      branchIds ?? targetUser.branchIds,
    );
    const nextRole = updatePayload.role ?? targetUser.role;
    this.assertRoleSpecificBranchRequirements(nextRole, nextBranchIds);
    const nextPayload = this.buildUserUpdate({
      ...updatePayload,
      ...(password
        ? {
            password: await hashPassword(password),
            passwordChangedAt: new Date(),
          }
        : {}),
      branchIds: nextBranchIds,
    });

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, nextPayload, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async updateForActor(
    id: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const normalizedDto = this.normalizeContactAliases(
      dto as UpdateUserDto & { isActive?: boolean },
    );
    const actorHasFullUserAccess = this.isSystemWideRole(actor.role);
    if (actor.userId === id && !actorHasFullUserAccess) {
      const {
        role,
        telegramId,
        roleKey,
        status,
        password,
        branchIds,
        ...selfPayload
      } = normalizedDto;

      if (role || telegramId || roleKey || status || password || branchIds) {
        throw new ForbiddenException(
          'Self-update is limited to profile fields only',
        );
      }

      return this.updateOwnProfile(id, selfPayload);
    }

    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertActorCanManageTarget(actor, targetUser);

    if (
      !actorHasFullUserAccess &&
      (normalizedDto.role || normalizedDto.status || normalizedDto.password)
    ) {
      throw new BadRequestException(
        'Use dedicated endpoints to change role, status, or password',
      );
    }

    const { roleKey, isActive, branchIds, password, ...updatePayload } =
      normalizedDto;
    await this.ensureUniqueFields(updatePayload, id);

    const nextBranchIds =
      branchIds === undefined
        ? this.normalizeBranchIds(targetUser.branchIds)
        : this.isBranchAdminRole(actor.role)
          ? this.assertActorCanAssignBranches(actor, branchIds)
          : this.normalizeBranchIds(branchIds);
    const nextRole = updatePayload.role ?? targetUser.role;
    this.assertRoleSpecificBranchRequirements(nextRole, nextBranchIds);
    const nextPayload = this.buildUserUpdate({
      ...updatePayload,
      ...(password
        ? {
            password: await hashPassword(password),
            passwordChangedAt: new Date(),
          }
        : {}),
      branchIds: nextBranchIds,
    });

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, nextPayload, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async updateRole(
    id: string,
    role: Role,
    actorRole: Role,
  ): Promise<PublicUser> {
    if (!Object.values(Role).includes(role)) {
      throw new ConflictException('Invalid role');
    }

    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageTarget(actorRole, targetUser.role);
    this.assertRoleCanBeAssigned(actorRole, role);
    await this.ensureLastOwnerRoleIsProtected(id, role);
    this.assertRoleSpecificBranchRequirements(
      role,
      this.normalizeBranchIds(targetUser.branchIds),
    );

    if (role !== Role.Teacher) {
      const [teachesCourses, teachesGroups, teachesSchedule] =
        await Promise.all([
          this.courseModel
            .exists({ $or: [{ teacherIds: id }, { teacherId: id }] })
            .exec(),
          this.groupModel.exists({ teacher: id }).exec(),
          this.scheduleModel.exists({ teacher: id }).exec(),
        ]);

      if (teachesCourses || teachesGroups || teachesSchedule) {
        throw new BadRequestException(
          'User cannot lose teacher role while assigned academic records exist',
        );
      }
    }

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, { role }, { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async updateRoleForActor(
    id: string,
    role: Role,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    if (!Object.values(Role).includes(role)) {
      throw new ConflictException('Invalid role');
    }

    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertActorCanManageTarget(actor, targetUser);
    this.assertRoleCanBeAssigned(actor.role, role);
    await this.ensureLastOwnerRoleIsProtected(id, role);
    this.assertRoleSpecificBranchRequirements(
      role,
      this.normalizeBranchIds(targetUser.branchIds),
    );

    if (role !== Role.Teacher) {
      const [teachesCourses, teachesGroups, teachesSchedule] =
        await Promise.all([
          this.courseModel
            .exists({ $or: [{ teacherIds: id }, { teacherId: id }] })
            .exec(),
          this.groupModel.exists({ teacher: id }).exec(),
          this.scheduleModel.exists({ teacher: id }).exec(),
        ]);

      if (teachesCourses || teachesGroups || teachesSchedule) {
        throw new BadRequestException(
          'User cannot lose teacher role while assigned academic records exist',
        );
      }
    }

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, { role }, { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actorRole: Role,
  ): Promise<PublicUser> {
    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageTarget(actorRole, targetUser.role);
    await this.ensureLastOwnerStatusIsProtected(id, dto.status);

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, this.applyStatusFields({ status: dto.status }), {
        new: true,
      })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async updateStatusForActor(
    id: string,
    dto: UpdateUserStatusDto,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertActorCanManageTarget(actor, targetUser);
    await this.ensureLastOwnerStatusIsProtected(id, dto.status);

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, this.applyStatusFields({ status: dto.status }), {
        new: true,
      })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must differ from the current password',
      );
    }

    const user = await this.assertPassword(id, currentPassword);
    user.password = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();
  }

  async update(
    id: string,
    dto: Partial<
      Pick<
        User,
        | 'email'
        | 'firstName'
        | 'lastName'
        | 'phoneNumber'
        | 'avatarUrl'
        | 'telegramId'
      >
    >,
  ): Promise<PublicUser> {
    const normalizedDto = this.normalizeContactAliases(
      dto as Partial<CreateUserDto>,
    );
    await this.ensureUniqueFields(normalizedDto, id);

    const updatedUser = await this.usersRepository
      .findByIdAndUpdate(id, this.buildUserUpdate(normalizedDto), { new: true })
      .exec();
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return mapUserResponse(this.sanitizeUser(updatedUser));
  }

  async remove(id: string, actorRole: Role): Promise<boolean> {
    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertCanManageTarget(actorRole, targetUser.role);
    await this.ensureLastOwnerRoleIsProtected(id, Role.Guest);
    await this.ensureUserHasNoReferences(id);

    const result = await this.usersRepository.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    return true;
  }

  async removeForActor(id: string, actor: AuthenticatedUser): Promise<boolean> {
    const targetUser = await this.usersRepository.findById(id).exec();
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    this.assertActorCanManageTarget(actor, targetUser);
    await this.ensureLastOwnerRoleIsProtected(id, Role.Guest);
    await this.ensureUserHasNoReferences(id);

    const result = await this.usersRepository.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    return true;
  }
}
