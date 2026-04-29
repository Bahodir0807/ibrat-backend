import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { Course, CourseDocument } from './schemas/course.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { CoursesListQueryDto } from './dto/courses-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../roles/roles.enum';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Schedule, ScheduleDocument } from '../schedule/schemas/schedule.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  private readonly coursePopulate = [
    { path: 'teacherId', select: 'username firstName lastName role email phoneNumber' },
    { path: 'students', select: 'username firstName lastName role email phoneNumber' },
  ];

  private extractReferenceId(value: unknown): string {
    if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
      return String((value as { id: unknown }).id);
    }

    return String(value ?? '');
  }

  private assertTeacherCanManageCourse(course: { teacherId?: unknown }, actor: AuthenticatedUser) {
    if (actor.role !== Role.Teacher) {
      return;
    }

    if (String(course.teacherId ?? '') !== actor.userId) {
      throw new ForbiddenException('Teachers can manage only their own courses');
    }
  }

  private assertActorCanReadCourse(
    course: { teacherId?: unknown; students?: unknown[] },
    actor: AuthenticatedUser,
  ) {
    if ([Role.Admin, Role.Owner, Role.Extra].includes(actor.role)) {
      return;
    }

    if (actor.role === Role.Teacher) {
      if (this.extractReferenceId(course.teacherId) !== actor.userId) {
        throw new ForbiddenException('Teachers can access only their own courses');
      }

      return;
    }

    if (actor.role === Role.Student) {
      const students = Array.isArray(course.students) ? course.students : [];
      const isMember = students.some(student => this.extractReferenceId(student) === actor.userId);
      if (!isMember) {
        throw new ForbiddenException('Students can access only their own courses');
      }
    }
  }

  async findDocumentById(id: string): Promise<CourseDocument | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.courseModel.findById(id).exec();
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

  private normalizePayload(dto: CreateCourseDto | UpdateCourseDto) {
    const payload: Record<string, unknown> = { ...dto };

    if ('teacherId' in dto && dto.teacherId !== undefined) {
      payload.teacherId = dto.teacherId ? this.toObjectId(dto.teacherId) : undefined;
    }

    if ('students' in dto && dto.students !== undefined) {
      payload.students = Array.from(
        new Set((dto.students ?? []).map(studentId => this.toObjectId(studentId)!.toString())),
      ).map(studentId => new Types.ObjectId(studentId));
    }

    return payload;
  }

  private getSort(query: CoursesListQueryDto) {
    const sortBy = query.sortBy && ['name', 'price', 'createdAt'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  private async validateRelations(payload: Record<string, unknown>) {
    if (payload.teacherId) {
      const teacher = await this.userModel.findById(payload.teacherId).lean().exec();
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
        throw new BadRequestException('Only users with student role can be assigned to a course');
      }
    }
  }

  async addManyStudentsToCourse(courseId: string, studentIds: string[]) {
    const course = await this.findDocumentById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const normalizedIds = Array.from(
      new Set(
        (studentIds ?? [])
          .filter(studentId => Types.ObjectId.isValid(studentId))
          .map(studentId => String(studentId)),
      ),
    );

    if (normalizedIds.length === 0) {
      return this.findOne(courseId);
    }

    const students = await this.userModel.find({ _id: { $in: normalizedIds } }).lean().exec();
    if (students.length !== normalizedIds.length) {
      throw new NotFoundException('One or more students were not found');
    }

    const invalidStudent = students.find(student => student.role !== Role.Student);
    if (invalidStudent) {
      throw new BadRequestException('Only users with student role can be assigned to a course');
    }

    const currentIds = (course.students ?? []).map(studentId => String(studentId));
    const nextIds = normalizedIds.filter(studentId => !currentIds.includes(studentId));

    if (nextIds.length > 0) {
      course.students ??= [];
      course.students.push(...nextIds.map(studentId => new Types.ObjectId(studentId)));
      await course.save();
    }

    return this.findOne(courseId);
  }

  async addManyStudentsToCourseForActor(
    courseId: string,
    studentIds: string[],
    actor: AuthenticatedUser,
  ) {
    if (actor.role === Role.Teacher) {
      const course = await this.findDocumentById(courseId);
      if (!course) {
        throw new ForbiddenException('Course not found or access denied');
      }

      this.assertTeacherCanManageCourse(course, actor);
    }

    return this.addManyStudentsToCourse(courseId, studentIds);
  }

  async create(createCourseDto: CreateCourseDto) {
    const payload = this.normalizePayload(createCourseDto);
    await this.validateRelations(payload);
    const createdCourse = await this.courseModel.create(payload);
    return this.findOne(String(createdCourse._id));
  }

  async createForActor(createCourseDto: CreateCourseDto, actor: AuthenticatedUser) {
    const payload = { ...createCourseDto };

    if (actor.role === Role.Teacher) {
      if (payload.teacherId && payload.teacherId !== actor.userId) {
        throw new ForbiddenException('Teachers can create courses only for themselves');
      }

      payload.teacherId = actor.userId;
    }

    return this.create(payload);
  }

  async findAll(query: CoursesListQueryDto = {}) {
    const filter: FilterQuery<CourseDocument> = {};

    if (query.teacherId) {
      filter.teacherId = this.toObjectId(query.teacherId);
    }

    if (query.studentId) {
      filter.students = this.toObjectId(query.studentId);
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

    const [courses, total] = await Promise.all([
      this.courseModel
        .find(filter)
        .populate(this.coursePopulate)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.courseModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(courses), total, page, limit);
  }

  async findAllForActor(query: CoursesListQueryDto, actor: AuthenticatedUser) {
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
      throw new BadRequestException('Invalid course ID');
    }

    const course = await this.courseModel.findById(id).populate(this.coursePopulate).exec();
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return serializeResource(course);
  }

  async findOneForActor(id: string, actor: AuthenticatedUser) {
    const course = await this.findOne(id);
    this.assertActorCanReadCourse(course as { teacherId?: unknown; students?: unknown[] }, actor);
    return course;
  }

  async update(id: string, updateCourseDto: UpdateCourseDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid course ID');
    }

    const payload = this.normalizePayload(updateCourseDto);
    await this.validateRelations(payload);

    const updatedCourse = await this.courseModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();

    if (!updatedCourse) {
      throw new NotFoundException('Course not found');
    }

    return this.findOne(id);
  }

  async updateForActor(id: string, updateCourseDto: UpdateCourseDto, actor: AuthenticatedUser) {
    const payload = { ...updateCourseDto };

    if (actor.role === Role.Teacher) {
      const course = await this.findDocumentById(id);
      if (!course) {
        throw new ForbiddenException('Course not found or access denied');
      }

      this.assertTeacherCanManageCourse(course, actor);

      if (payload.teacherId && payload.teacherId !== actor.userId) {
        throw new ForbiddenException('Teachers cannot reassign courses to another teacher');
      }

      payload.teacherId = actor.userId;
    }

    return this.update(id, payload);
  }

  async remove(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid course ID');
    }

    const [groupsExist, schedulesExist, paymentsExist] = await Promise.all([
      this.groupModel.exists({ course: id }).exec(),
      this.scheduleModel.exists({ course: id }).exec(),
      this.paymentModel.exists({ course: id }).exec(),
    ]);

    if (groupsExist || schedulesExist || paymentsExist) {
      throw new BadRequestException('Course cannot be deleted while dependent groups, schedule entries, or payments exist');
    }

    const result = await this.courseModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Course not found');
    }

    return true;
  }
}
