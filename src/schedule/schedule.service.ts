import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Schedule, ScheduleDocument } from './schemas/schedule.schema';
import { ScheduleRepository } from './schedule.repository';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleListQueryDto } from './dto/schedule-list-query.dto';
import { Role } from '../roles/roles.enum';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Room, RoomDocument } from '../rooms/schemas/room.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { mapScheduleResponse, mapScheduleResponses } from './dto/schedule-response.dto';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Room.name) private readonly roomModel: Model<RoomDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  private readonly schedulePopulate = [
    { path: 'course', select: 'name description price teacherId students' },
    { path: 'teacher', select: 'username firstName lastName role' },
    { path: 'students', select: 'username firstName lastName role' },
    { path: 'room', select: 'name capacity type isAvailable description' },
    { path: 'group', select: 'name course teacher students' },
  ];

  private extractReferenceId(value: unknown): string {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
      return String((value as { id: unknown }).id);
    }

    return String(value ?? '');
  }

  private normalizeBranchIds(branchIds?: string[]): string[] {
    return [...new Set((branchIds ?? [])
      .filter((branchId): branchId is string => typeof branchId === 'string')
      .map(branchId => branchId.trim())
      .filter(branchId => branchId.length > 0))];
  }

  private assertTeacherCanManageSchedule(schedule: { teacher?: unknown }, actor: AuthenticatedUser) {
    if (actor.role !== Role.Teacher) {
      return;
    }

    if (String(schedule.teacher ?? '') !== actor.userId) {
      throw new ForbiddenException('Teachers can manage only their own schedule');
    }
  }

  private async assertBranchAdminCanAccessSchedule(
    schedule: { teacher?: unknown; students?: unknown[] },
    actor: AuthenticatedUser,
  ): Promise<void> {
    const actorBranches = this.normalizeBranchIds(actor.branchIds);
    if (actorBranches.length === 0) {
      throw new ForbiddenException('User has no assigned branch scope');
    }

    const teacherId = this.extractReferenceId(schedule.teacher);
    const teacher = teacherId && Types.ObjectId.isValid(teacherId)
      ? await this.userModel.findById(teacherId, { branchIds: 1 }).lean().exec()
      : null;

    const teacherBranches = this.normalizeBranchIds(teacher?.branchIds);
    if (teacherBranches.some(branchId => actorBranches.includes(branchId))) {
      return;
    }

    const scheduleStudentIds = Array.isArray(schedule.students)
      ? schedule.students.map(student => this.extractReferenceId(student)).filter(Boolean)
      : [];

    if (scheduleStudentIds.length === 0) {
      throw new NotFoundException('Schedule not found');
    }

    const students = await this.userModel
      .find({ _id: { $in: scheduleStudentIds } }, { branchIds: 1 })
      .lean()
      .exec();

    const hasScopedStudent = students.some(student => this.normalizeBranchIds(student.branchIds)
      .some(branchId => actorBranches.includes(branchId)));

    if (!hasScopedStudent) {
      throw new NotFoundException('Schedule not found');
    }
  }

  private async assertActorCanReadSchedule(
    schedule: { teacher?: unknown; students?: unknown[] },
    actor: AuthenticatedUser,
  ): Promise<void> {
    if ([Role.Owner, Role.Extra].includes(actor.role)) {
      return;
    }

    if (actor.role === Role.Admin) {
      await this.assertBranchAdminCanAccessSchedule(schedule, actor);
      return;
    }

    if (actor.role === Role.Teacher) {
      if (this.extractReferenceId(schedule.teacher) !== actor.userId) {
        throw new ForbiddenException('Teachers can access only their own schedule');
      }

      return;
    }

    if (actor.role === Role.Student) {
      const students = Array.isArray(schedule.students) ? schedule.students : [];
      const isParticipant = students.some(student => this.extractReferenceId(student) === actor.userId);
      if (!isParticipant) {
        throw new ForbiddenException('Students can access only their own schedule');
      }
    }
  }

  async findDocumentById(id: string): Promise<ScheduleDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.scheduleRepository.findById(id).exec();
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

  private toScheduleState(dto: CreateScheduleDto | UpdateScheduleDto | Record<string, unknown>) {
    const payload = this.normalizePayload(dto as CreateScheduleDto | UpdateScheduleDto) as Record<string, unknown>;

    if (payload.date) {
      payload.date = new Date(String(payload.date));
    }

    if (payload.timeStart) {
      payload.timeStart = new Date(String(payload.timeStart));
    }

    if (payload.timeEnd) {
      payload.timeEnd = new Date(String(payload.timeEnd));
    }

    return payload as {
      course: Types.ObjectId;
      room: Types.ObjectId;
      date: Date;
      timeStart: Date;
      timeEnd: Date;
      teacher: Types.ObjectId;
      students?: Types.ObjectId[];
      group?: Types.ObjectId;
    };
  }

  private getDayRange(value: Date) {
    const start = new Date(value);
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(value);
    end.setUTCHours(23, 59, 59, 999);

    return { start, end };
  }

  private ensureValidTimeRange(date: Date, timeStart: Date, timeEnd: Date) {
    if (
      Number.isNaN(date.getTime())
      || Number.isNaN(timeStart.getTime())
      || Number.isNaN(timeEnd.getTime())
    ) {
      throw new BadRequestException('Invalid schedule date or time');
    }

    if (timeStart >= timeEnd) {
      throw new BadRequestException('timeStart must be earlier than timeEnd');
    }

    const { start, end } = this.getDayRange(date);
    if (timeStart < start || timeStart > end || timeEnd < start || timeEnd > end) {
      throw new BadRequestException('timeStart and timeEnd must belong to the same schedule date');
    }
  }

  private async validateRelationsAndConflicts(
    state: {
      course: Types.ObjectId;
      room: Types.ObjectId;
      date: Date;
      timeStart: Date;
      timeEnd: Date;
      teacher: Types.ObjectId;
      students?: Types.ObjectId[];
      group?: Types.ObjectId;
    },
    excludeId?: string,
  ) {
    this.ensureValidTimeRange(state.date, state.timeStart, state.timeEnd);

    const [course, room, teacher, group] = await Promise.all([
      this.courseModel.findById(state.course).lean().exec(),
      this.roomModel.findById(state.room).lean().exec(),
      this.userModel.findById(state.teacher).lean().exec(),
      state.group ? this.groupModel.findById(state.group).lean().exec() : Promise.resolve(null),
    ]);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (!room.isAvailable) {
      throw new BadRequestException('Selected room is not available');
    }

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    if (teacher.role !== Role.Teacher) {
      throw new BadRequestException('Assigned teacher must have teacher role');
    }

    if (course.teacherId && String(course.teacherId) !== String(state.teacher)) {
      throw new BadRequestException('Schedule teacher must match the course teacher');
    }

    let allowedStudentIds = new Set<string>(
      Array.isArray(course.students) ? course.students.map(studentId => String(studentId)) : [],
    );

    if (state.group) {
      if (!group) {
        throw new NotFoundException('Group not found');
      }

      if (String(group.course) !== String(state.course)) {
        throw new BadRequestException('Group must belong to the selected course');
      }

      if (String(group.teacher) !== String(state.teacher)) {
        throw new BadRequestException('Group teacher must match the schedule teacher');
      }

      allowedStudentIds = new Set(
        Array.isArray(group.students) ? group.students.map(studentId => String(studentId)) : [],
      );

      if (!state.students || state.students.length === 0) {
        state.students = group.students.map(studentId => new Types.ObjectId(String(studentId)));
      }
    }

    if (state.students && state.students.length > 0) {
      const students = await this.userModel.find({ _id: { $in: state.students } }).lean().exec();
      if (students.length !== state.students.length) {
        throw new NotFoundException('One or more students were not found');
      }

      const invalidStudent = students.find(student => student.role !== Role.Student);
      if (invalidStudent) {
        throw new BadRequestException('Only users with student role can be assigned to schedule');
      }

      const notEnrolled = state.students.find(studentId => !allowedStudentIds.has(String(studentId)));
      if (notEnrolled) {
        throw new BadRequestException('All scheduled students must be enrolled in the related course or group');
      }
    }

    const { start, end } = this.getDayRange(state.date);
    const overlapFilter: FilterQuery<ScheduleDocument> = {
      ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      date: { $gte: start, $lte: end },
      timeStart: { $lt: state.timeEnd },
      timeEnd: { $gt: state.timeStart },
      $or: [
        { room: state.room },
        { teacher: state.teacher },
        ...(state.group ? [{ group: state.group }] : []),
        ...(state.students && state.students.length > 0 ? [{ students: { $in: state.students } }] : []),
      ],
    };

    const conflictingSchedule = await this.scheduleRepository.findOne(overlapFilter).lean().exec();
    if (conflictingSchedule) {
      throw new BadRequestException('Schedule conflicts with an existing room, teacher, group, or student allocation');
    }
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

  async getScheduleByUserIdForActor(userId: string, actor: AuthenticatedUser) {
    if (actor.role === Role.Teacher && actor.userId !== userId) {
      throw new ForbiddenException('Teachers can access only their own schedule');
    }

    if ([Role.Owner, Role.Extra].includes(actor.role)) {
      return this.getScheduleByUserId(userId);
    }

    if (actor.role === Role.Admin) {
      const user = await this.userModel.findById(userId).lean().exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const actorBranches = this.normalizeBranchIds(actor.branchIds);
      if (actorBranches.length === 0) {
        throw new ForbiddenException('User has no assigned branch scope');
      }

      const userBranches = this.normalizeBranchIds(user.branchIds);

      if (!userBranches.some(branchId => actorBranches.includes(branchId))) {
        throw new NotFoundException('User not found');
      }

      return this.getScheduleByUserId(userId);
    }

    return this.getScheduleForUser(userId, actor.role);
  }

  async getScheduleByUserId(userId: string) {
    const filter = {
      $or: [
        { teacher: this.toObjectId(userId) },
        { students: this.toObjectId(userId) },
      ],
    };

    const [schedule, total] = await Promise.all([
      this.scheduleRepository
      .find(filter)
      .populate(this.schedulePopulate)
      .sort({ date: 1, timeStart: 1 })
      .limit(100)
      .exec(),
      this.scheduleRepository.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(mapScheduleResponses(schedule), total, 1, 100);
  }

  async findAll(query: ScheduleListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);

    const [schedule, total] = await Promise.all([
      this.scheduleRepository
        .find(filter)
        .populate(this.schedulePopulate)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.scheduleRepository.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(mapScheduleResponses(schedule), total, page, limit);
  }

  async findAllForActor(query: ScheduleListQueryDto, actor: AuthenticatedUser) {
    if (actor.role === Role.Teacher) {
      return this.findAll({ ...query, teacherId: actor.userId });
    }

    if (actor.role === Role.Admin) {
      const actorBranches = this.normalizeBranchIds(actor.branchIds);
      if (actorBranches.length === 0) {
        throw new ForbiddenException('User has no assigned branch scope');
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      if (query.teacherId) {
        const teacher = await this.userModel.findById(query.teacherId, { branchIds: 1 }).lean().exec();
        if (!teacher) {
          throw new NotFoundException('Teacher not found');
        }

        const teacherBranches = this.normalizeBranchIds(teacher.branchIds);
        if (!teacherBranches.some(branchId => actorBranches.includes(branchId))) {
          throw new NotFoundException('Teacher not found');
        }
      }

      if (query.studentId) {
        const student = await this.userModel.findById(query.studentId, { branchIds: 1, role: 1 }).lean().exec();
        if (!student || student.role !== Role.Student) {
          throw new NotFoundException('Student not found');
        }

        const studentBranches = this.normalizeBranchIds(student.branchIds);
        if (!studentBranches.some(branchId => actorBranches.includes(branchId))) {
          throw new NotFoundException('Student not found');
        }
      }

      const [scopedTeachers, scopedStudents] = await Promise.all([
        this.userModel.find({ role: Role.Teacher, branchIds: { $in: actorBranches } }, { _id: 1 }).lean().exec(),
        this.userModel.find({ role: Role.Student, branchIds: { $in: actorBranches } }, { _id: 1 }).lean().exec(),
      ]);

      const teacherIds = scopedTeachers.map(teacher => teacher._id);
      const studentIds = scopedStudents.map(student => student._id);
      if (teacherIds.length === 0 && studentIds.length === 0) {
        return createPaginatedResult([], 0, query.page ?? 1, query.limit ?? 20);
      }

      const baseFilter = this.buildFilter(query);
      baseFilter.$or = [
        ...(teacherIds.length > 0 ? [{ teacher: { $in: teacherIds } }] : []),
        ...(studentIds.length > 0 ? [{ students: { $in: studentIds } }] : []),
      ];

      const [schedule, total] = await Promise.all([
        this.scheduleRepository
          .find(baseFilter)
          .populate(this.schedulePopulate)
          .sort(this.getSort(query))
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.scheduleRepository.countDocuments(baseFilter).exec(),
      ]);

      return createPaginatedResult(mapScheduleResponses(schedule), total, page, limit);
    }

    return this.findAll(query);
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const schedule = await this.scheduleRepository.findById(id).populate(this.schedulePopulate).exec();
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return mapScheduleResponse(schedule);
  }

  async findOneForActor(id: string, actor: AuthenticatedUser) {
    const schedule = await this.findOne(id);
    await this.assertActorCanReadSchedule(schedule as { teacher?: unknown; students?: unknown[] }, actor);
    return schedule;
  }

  async create(createScheduleDto: CreateScheduleDto) {
    const scheduleState = this.toScheduleState(createScheduleDto);
    await this.validateRelationsAndConflicts(scheduleState);

    const schedule = await this.scheduleRepository.create(scheduleState);
    return this.findOne(String(schedule._id));
  }

  async createForActor(createScheduleDto: CreateScheduleDto, actor: AuthenticatedUser) {
    const payload = { ...createScheduleDto };

    if (actor.role === Role.Teacher) {
      if (payload.teacher && payload.teacher !== actor.userId) {
        throw new ForbiddenException('Teachers can create schedule only for themselves');
      }

      payload.teacher = actor.userId;
    }

    if (actor.role === Role.Admin) {
      const actorBranches = this.normalizeBranchIds(actor.branchIds);
      if (actorBranches.length === 0) {
        throw new ForbiddenException('User has no assigned branch scope');
      }

      const teacher = await this.userModel.findById(payload.teacher, { branchIds: 1 }).lean().exec();
      if (!teacher) {
        throw new NotFoundException('Teacher not found');
      }

      const teacherBranches = this.normalizeBranchIds(teacher.branchIds);
      if (!teacherBranches.some(branchId => actorBranches.includes(branchId))) {
        throw new ForbiddenException('Cannot create schedule outside branch scope');
      }

      if (payload.students?.length) {
        const students = await this.userModel
          .find({ _id: { $in: payload.students } }, { branchIds: 1, role: 1 })
          .lean()
          .exec();

        if (students.length !== payload.students.length) {
          throw new NotFoundException('One or more students were not found');
        }

        const outOfScopeStudent = students.find(student => {
          if (student.role !== Role.Student) {
            return true;
          }

          const studentBranches = this.normalizeBranchIds(student.branchIds);
          return !studentBranches.some(branchId => actorBranches.includes(branchId));
        });

        if (outOfScopeStudent) {
          throw new ForbiddenException('Cannot create schedule outside branch scope');
        }
      }
    }

    return this.create(payload);
  }

  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const existing = await this.scheduleRepository.findById(id).lean().exec();
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    const mergedState = this.toScheduleState({
      course: String(existing.course),
      room: String(existing.room),
      date: existing.date.toISOString(),
      timeStart: existing.timeStart.toISOString(),
      timeEnd: existing.timeEnd.toISOString(),
      teacher: String(existing.teacher),
      students: Array.isArray(existing.students) ? existing.students.map(studentId => String(studentId)) : [],
      group: existing.group ? String(existing.group) : undefined,
      ...updateScheduleDto,
    });

    await this.validateRelationsAndConflicts(mergedState, id);

    const updated = await this.scheduleRepository
      .findByIdAndUpdate(id, mergedState, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Schedule not found');
    }

    return this.findOne(id);
  }

  async updateForActor(id: string, updateScheduleDto: UpdateScheduleDto, actor: AuthenticatedUser) {
    const payload = { ...updateScheduleDto };

    if (actor.role === Role.Teacher) {
      const schedule = await this.findDocumentById(id);
      if (!schedule) {
        throw new ForbiddenException('Schedule not found or access denied');
      }

      this.assertTeacherCanManageSchedule(schedule, actor);

      if (payload.teacher && payload.teacher !== actor.userId) {
        throw new ForbiddenException('Teachers cannot reassign schedule to another teacher');
      }

      payload.teacher = actor.userId;
    }

    if (actor.role === Role.Admin) {
      const actorBranches = this.normalizeBranchIds(actor.branchIds);
      if (actorBranches.length === 0) {
        throw new ForbiddenException('User has no assigned branch scope');
      }

      const existing = await this.findOne(id);
      await this.assertBranchAdminCanAccessSchedule(
        existing as { teacher?: unknown; students?: unknown[] },
        actor,
      );

      if (payload.teacher) {
        const teacher = await this.userModel.findById(payload.teacher, { branchIds: 1 }).lean().exec();
        if (!teacher) {
          throw new NotFoundException('Teacher not found');
        }

        const teacherBranches = this.normalizeBranchIds(teacher.branchIds);
        if (!teacherBranches.some(branchId => actorBranches.includes(branchId))) {
          throw new ForbiddenException('Cannot update schedule outside branch scope');
        }
      }

      if (payload.students?.length) {
        const students = await this.userModel
          .find({ _id: { $in: payload.students } }, { branchIds: 1, role: 1 })
          .lean()
          .exec();

        if (students.length !== payload.students.length) {
          throw new NotFoundException('One or more students were not found');
        }

        const outOfScopeStudent = students.find(student => {
          if (student.role !== Role.Student) {
            return true;
          }

          const studentBranches = this.normalizeBranchIds(student.branchIds);
          return !studentBranches.some(branchId => actorBranches.includes(branchId));
        });

        if (outOfScopeStudent) {
          throw new ForbiddenException('Cannot update schedule outside branch scope');
        }
      }
    }

    return this.update(id, payload);
  }

  async removeForActor(id: string, actor: AuthenticatedUser) {
    if (actor.role === Role.Admin) {
      const existing = await this.findOne(id);
      await this.assertBranchAdminCanAccessSchedule(
        existing as { teacher?: unknown; students?: unknown[] },
        actor,
      );
    }

    if (actor.role === Role.Teacher) {
      throw new ForbiddenException('Teachers cannot delete schedule');
    }

    return this.remove(id);
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const attendanceExists = await this.attendanceModel.exists({ schedule: id }).exec();
    if (attendanceExists) {
      throw new BadRequestException('Schedule cannot be deleted while attendance records reference it');
    }

    const deleted = await this.scheduleRepository.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Schedule not found');
    }

    return true;
  }
}
