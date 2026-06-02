import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  ensureActorBranchScope,
  isBranchAdminRole,
  isSystemWideRole,
  toObjectIds,
} from '../common/access/actor-scope';
import { Role } from '../roles/roles.enum';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsListQueryDto } from './dto/students-list-query.dto';
import {
  mapStudentResponse,
  mapStudentResponses,
} from './dto/student-response.dto';
import { StudentStatus } from './student-status.enum';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
  ) {}

  private normalizeIds(ids?: string[]): string[] {
    return [
      ...new Set(
        (ids ?? [])
          .filter((id): id is string => typeof id === 'string')
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    ];
  }

  private normalizeObjectIds(ids?: string[]): Types.ObjectId[] {
    const normalized = this.normalizeIds(ids);
    const invalid = normalized.find((id) => !Types.ObjectId.isValid(id));
    if (invalid) {
      throw new BadRequestException(`Invalid ObjectId: ${invalid}`);
    }
    return normalized.map((id) => new Types.ObjectId(id));
  }

  private normalizeBranchIds(branchIds?: string[]): Types.ObjectId[] {
    return this.normalizeObjectIds(branchIds);
  }

  private normalizeBranchIdStrings(branchIds?: unknown[]): string[] {
    return [
      ...new Set(
        (branchIds ?? [])
          .filter((branchId) => branchId !== null && branchId !== undefined)
          .map((branchId) => String(branchId).trim())
          .filter((branchId) => branchId.length > 0),
      ),
    ];
  }

  private async generateStudentNumber(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const base = Date.now().toString().slice(-8);
      const suffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
      const candidate = `${base}${suffix}`;
      const existing = await this.studentModel
        .exists({ studentNumber: candidate })
        .exec();
      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException(
      'Unable to allocate unique student number, please retry',
    );
  }

  private assertActive(student: Pick<StudentDocument, 'isActive' | 'status'>) {
    if (
      student.isActive === false ||
      [
        StudentStatus.Archived,
        StudentStatus.Deleted,
        StudentStatus.Inactive,
      ].includes(student.status)
    ) {
      throw new BadRequestException('Student is not active');
    }
  }

  private async ensureRelationsExist(dto: CreateStudentDto | UpdateStudentDto) {
    const courseIds = this.normalizeIds(dto.courseIds);
    if (courseIds.length > 0) {
      const count = await this.courseModel
        .countDocuments({ _id: { $in: toObjectIds(courseIds) } })
        .exec();
      if (count !== courseIds.length) {
        throw new NotFoundException('One or more courses were not found');
      }
    }

    const groupIds = this.normalizeIds(dto.groupIds);
    if (groupIds.length > 0) {
      const count = await this.groupModel
        .countDocuments({ _id: { $in: toObjectIds(groupIds) } })
        .exec();
      if (count !== groupIds.length) {
        throw new NotFoundException('One or more groups were not found');
      }
    }
  }

  private buildPayload(dto: CreateStudentDto | UpdateStudentDto) {
    const payload: Record<string, unknown> = { ...dto };

    if ('groupIds' in dto && dto.groupIds !== undefined) {
      payload.groupIds = this.normalizeObjectIds(dto.groupIds);
    }

    if ('courseIds' in dto && dto.courseIds !== undefined) {
      payload.courseIds = this.normalizeObjectIds(dto.courseIds);
    }

    if ('branchIds' in dto && dto.branchIds !== undefined) {
      payload.branchIds = this.normalizeBranchIds(dto.branchIds);
    }

    if ('paymentDueDate' in dto && dto.paymentDueDate) {
      payload.paymentDueDate = new Date(dto.paymentDueDate);
    }

    if ('status' in dto && dto.status !== undefined) {
      payload.isActive = ![
        StudentStatus.Archived,
        StudentStatus.Deleted,
        StudentStatus.Inactive,
      ].includes(dto.status);
    }

    if ('isActive' in dto && dto.isActive !== undefined && !dto.isActive) {
      payload.status = dto.status ?? StudentStatus.Inactive;
    }

    return payload;
  }

  private async getTeacherVisibleStudentIds(teacherId: string) {
    const [courses, groups] = await Promise.all([
      this.courseModel
        .find(
          { $or: [{ teacherId }, { teacherIds: teacherId }] },
          { students: 1 },
        )
        .lean()
        .exec(),
      this.groupModel
        .find({ teacher: teacherId }, { students: 1 })
        .lean()
        .exec(),
    ]);

    return [
      ...new Set(
        [...courses, ...groups].flatMap((item) =>
          Array.isArray(item.students)
            ? item.students.map((studentId) => String(studentId))
            : [],
        ),
      ),
    ];
  }

  private async buildActorFilter(
    query: StudentsListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<FilterQuery<StudentDocument>> {
    const filterParts: FilterQuery<StudentDocument>[] = [];

    if (query.status) {
      filterParts.push({ status: query.status });
    } else {
      filterParts.push({ status: { $ne: StudentStatus.Deleted } });
    }

    if (query.isActive !== undefined) {
      filterParts.push({ isActive: query.isActive });
    }

    if (query.branchId) {
      filterParts.push({ branchIds: new Types.ObjectId(query.branchId) });
    }

    if (query.courseId) {
      filterParts.push({ courseIds: new Types.ObjectId(query.courseId) });
    }

    if (query.groupId) {
      filterParts.push({ groupIds: new Types.ObjectId(query.groupId) });
    }

    if (query.teacherId) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(
        query.teacherId,
      );
      filterParts.push({ _id: { $in: toObjectIds(visibleStudentIds) } });
    }

    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      filterParts.push({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { phoneNumber: regex },
          { telegramId: regex },
          { parentPhoneNumber: regex },
          { parentName: regex },
        ],
      });
    }

    if (isBranchAdminRole(actor.role)) {
      filterParts.push({
        branchIds: { $in: toObjectIds(ensureActorBranchScope(actor)) },
      });
    } else if (actor.role === Role.Teacher) {
      const visibleStudentIds = await this.getTeacherVisibleStudentIds(
        actor.userId,
      );
      filterParts.push({ _id: { $in: toObjectIds(visibleStudentIds) } });
    } else if (!isSystemWideRole(actor.role)) {
      throw new ForbiddenException('You are not allowed to access students');
    }

    return filterParts.length > 1 ? { $and: filterParts } : filterParts[0];
  }

  async findAll(query: StudentsListQueryDto, actor: AuthenticatedUser) {
    const filter = await this.buildActorFilter(query, actor);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy =
      query.sortBy &&
      ['firstName', 'lastName', 'createdAt', 'status'].includes(query.sortBy)
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [students, total] = await Promise.all([
      this.studentModel
        .find(filter)
        .sort({ [sortBy]: sortOrder as SortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.studentModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(
      mapStudentResponses(students),
      total,
      page,
      limit,
    );
  }

  async findById(id: string, actor: AuthenticatedUser) {
    const filter = await this.buildActorFilter({}, actor);
    const student = await this.studentModel
      .findOne({ $and: [{ _id: id }, filter] })
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return mapStudentResponse(student);
  }

  async create(dto: CreateStudentDto, actor: AuthenticatedUser) {
    if (!isSystemWideRole(actor.role) && !isBranchAdminRole(actor.role)) {
      throw new ForbiddenException('You are not allowed to create students');
    }

    await this.ensureRelationsExist(dto);
    const payload = this.buildPayload(dto);
    payload.studentNumber = await this.generateStudentNumber();
    if (isBranchAdminRole(actor.role)) {
      const actorBranches = ensureActorBranchScope(actor);
      const branchIds = this.normalizeBranchIds(dto.branchIds);
      const branchIdStrings = this.normalizeBranchIdStrings(branchIds);
      if (
        branchIds.length > 0 &&
        !branchIdStrings.every((branchId) => actorBranches.includes(branchId))
      ) {
        throw new ForbiddenException('Student branch is outside your scope');
      }
      payload.branchIds =
        branchIds.length > 0 ? branchIds : toObjectIds(actorBranches);
    }

    const student = await this.studentModel.create(payload);
    return mapStudentResponse(student);
  }

  async createFromTelegramRequest(dto: {
    name: string;
    phone: string;
    telegramId: number;
  }) {
    const [firstName, ...rest] = dto.name.trim().split(/\s+/);
    const student = await this.studentModel.create({
      studentNumber: await this.generateStudentNumber(),
      firstName: firstName || dto.name,
      lastName: rest.join(' '),
      phoneNumber: dto.phone,
      telegramId: String(dto.telegramId),
      isActive: true,
      status: StudentStatus.Active,
    });
    return mapStudentResponse(student);
  }

  async update(id: string, dto: UpdateStudentDto, actor: AuthenticatedUser) {
    await this.findById(id, actor);
    if (!isSystemWideRole(actor.role) && !isBranchAdminRole(actor.role)) {
      throw new ForbiddenException('You are not allowed to update students');
    }

    await this.ensureRelationsExist(dto);
    const payload = this.buildPayload(dto);
    const student = await this.studentModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return mapStudentResponse(student);
  }

  async findActiveDocumentById(id: string): Promise<StudentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid student ID');
    }
    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    this.assertActive(student);
    return student;
  }

  async findDocumentById(id: string): Promise<StudentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid student ID');
    }
    const student = await this.studentModel.findById(id).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  async softDelete(id: string, actor: AuthenticatedUser) {
    await this.findById(id, actor);
    if (!isSystemWideRole(actor.role) && !isBranchAdminRole(actor.role)) {
      throw new ForbiddenException('You are not allowed to delete students');
    }

    const student = await this.studentModel
      .findByIdAndUpdate(
        id,
        { isActive: false, status: StudentStatus.Archived },
        { new: true },
      )
      .exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return mapStudentResponse(student);
  }
}
