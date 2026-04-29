import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private readonly paymentPopulate = [
    { path: 'student', select: 'username firstName lastName role email phoneNumber' },
    { path: 'course', select: 'name description price teacherId' },
  ];

  private normalizeBranchIds(branchIds?: string[]): string[] {
    return [...new Set((branchIds ?? [])
      .filter((branchId): branchId is string => typeof branchId === 'string')
      .map(branchId => branchId.trim())
      .filter(branchId => branchId.length > 0))];
  }

  private isSystemWideRole(role?: Role): boolean {
    return role === Role.Owner || role === Role.Extra;
  }

  private isBranchAdminRole(role?: Role): boolean {
    return role === Role.Admin;
  }

  private ensureScopedActorHasBranches(actor: AuthenticatedUser): string[] {
    const branchIds = this.normalizeBranchIds(actor.branchIds);
    if (!this.isSystemWideRole(actor.role) && branchIds.length === 0) {
      throw new ForbiddenException('User has no assigned branch scope');
    }

    return branchIds;
  }

  private assertActorCanAccessStudent(actor: AuthenticatedUser, student: Pick<UserDocument, '_id' | 'role' | 'branchIds'>): void {
    if (this.isSystemWideRole(actor.role)) {
      return;
    }

    if (actor.role === Role.Student) {
      if (actor.userId === String(student._id)) {
        return;
      }

      throw new ForbiddenException('Students can only access their own payments');
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const studentBranches = this.normalizeBranchIds(student.branchIds);
      if (studentBranches.some(branchId => actorBranches.includes(branchId))) {
        return;
      }

      throw new NotFoundException('Student not found');
    }

    throw new ForbiddenException('You are not allowed to access payments');
  }

  private getSort(query: PaymentsListQueryDto) {
    const sortBy = query.sortBy && ['createdAt', 'paidAt', 'amount'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  private buildFilter(query: PaymentsListQueryDto = {}): FilterQuery<PaymentDocument> {
    const filter: FilterQuery<PaymentDocument> = {};

    if (query.studentId) {
      filter.student = new Types.ObjectId(query.studentId);
    }

    if (query.courseId) {
      filter.course = new Types.ObjectId(query.courseId);
    }

    if (query.status) {
      filter.isConfirmed = query.status === 'confirmed';
    }

    return filter;
  }

  async create(dto: CreatePaymentDto) {
    const [student, course, existingPayment] = await Promise.all([
      this.userModel.findById(dto.student).lean().exec(),
      this.courseModel.findById(dto.courseId).lean().exec(),
      this.paymentModel.findOne({ student: dto.student, course: dto.courseId }).lean().exec(),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.role !== Role.Student) {
      throw new BadRequestException('Payments can only be created for students');
    }

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (typeof course.price !== 'number' || Number.isNaN(course.price) || course.price <= 0) {
      throw new BadRequestException('Course price must be a positive number');
    }

    const isEnrolled = Array.isArray(course.students)
      && course.students.some(studentId => String(studentId) === dto.student);
    if (!isEnrolled) {
      throw new BadRequestException('Student is not enrolled in the selected course');
    }

    if (existingPayment) {
      throw new ConflictException('Payment for this student and course already exists');
    }

    const coursesOfStudent = await this.courseModel.find({ students: dto.student }).lean();
    const hasMultipleCourses = coursesOfStudent.length > 1;
    const finalPrice = hasMultipleCourses ? Math.round(course.price * 0.9) : course.price;

    if (finalPrice <= 0) {
      throw new BadRequestException('Calculated payment amount must be greater than zero');
    }

    const payment = await this.paymentModel.create({
      student: dto.student,
      course: dto.courseId,
      amount: finalPrice,
      isConfirmed: false,
      paidAt: dto.paidAt ?? new Date(),
    });

    return this.findOne(String(payment._id));
  }

  async createForActor(dto: CreatePaymentDto, actor: AuthenticatedUser) {
    const student = await this.userModel.findById(dto.student).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.create(dto);
  }

  async findOne(id: string) {
    const payment = await this.paymentModel.findById(id).populate(this.paymentPopulate).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return serializeResource(payment);
  }

  async getAll(query: PaymentsListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(filter)
        .populate(this.paymentPopulate)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(payments), total, page, limit);
  }

  async getAllForActor(query: PaymentsListQueryDto = {}, actor: AuthenticatedUser) {
    if (this.isSystemWideRole(actor.role)) {
      return this.getAll(query);
    }

    if (this.isBranchAdminRole(actor.role)) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const scopedStudents = await this.userModel
        .find({ role: Role.Student, branchIds: { $in: actorBranches } }, { _id: 1 })
        .lean()
        .exec();
      const studentIds = scopedStudents.map(student => String(student._id));

      if (query.studentId && !studentIds.includes(query.studentId)) {
        throw new NotFoundException('Student not found');
      }

      if (studentIds.length === 0) {
        return createPaginatedResult([], 0, query.page ?? 1, query.limit ?? 20);
      }

      const filter = this.buildFilter(query);
      filter.student = query.studentId
        ? new Types.ObjectId(query.studentId)
        : { $in: studentIds.map(studentId => new Types.ObjectId(studentId)) };

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const [payments, total] = await Promise.all([
        this.paymentModel
          .find(filter)
          .populate(this.paymentPopulate)
          .sort(this.getSort(query))
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.paymentModel.countDocuments(filter).exec(),
      ]);

      return createPaginatedResult(serializeResources(payments), total, page, limit);
    }

    throw new ForbiddenException('You are not allowed to access payments');
  }

  async getByStudent(studentId: string, query: PaymentsListQueryDto = {}) {
    return this.getAll({ ...query, studentId });
  }

  async getByStudentForActor(studentId: string, query: PaymentsListQueryDto, actor: AuthenticatedUser) {
    const student = await this.userModel.findById(studentId).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.getByStudent(studentId, query);
  }

  async confirmPayment(paymentId: string) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const payment = await this.paymentModel
      .findByIdAndUpdate(
        paymentId,
        { isConfirmed: true, paidAt: new Date() },
        { new: true },
      )
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.findOne(paymentId);
  }

  async confirmPaymentForActor(paymentId: string, actor: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const payment = await this.paymentModel.findById(paymentId).populate('student').exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const student = payment.student as unknown as UserDocument | null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.confirmPayment(paymentId);
  }

  async delete(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const existingPayment = await this.paymentModel.findById(id).lean().exec();
    if (!existingPayment) {
      throw new NotFoundException('Payment not found');
    }

    if (existingPayment.isConfirmed) {
      throw new BadRequestException('Confirmed payments cannot be deleted');
    }

    const payment = await this.paymentModel.findByIdAndDelete(id).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return true;
  }

  async deleteForActor(id: string, actor: AuthenticatedUser): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const payment = await this.paymentModel.findById(id).populate('student').exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const student = payment.student as unknown as UserDocument | null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.delete(id);
  }
}
