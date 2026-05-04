import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { mapPaymentResponse, mapPaymentResponses } from './dto/payment-response.dto';
import { PaymentStatus } from './payment-status.enum';
import { FinancialTransactionType } from './financial-transaction-type.enum';
import { FinancialTransactionsRepository } from './financial-transactions.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly financialTransactionsRepository: FinancialTransactionsRepository,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private readonly paymentPopulate = [
    { path: 'student', select: 'username firstName lastName role' },
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
      filter.status = query.status;
    }

    return filter;
  }

  private resolveStatus(payment: Pick<Payment, 'status' | 'isConfirmed'>): PaymentStatus {
    return payment.status ?? (payment.isConfirmed ? PaymentStatus.Confirmed : PaymentStatus.Pending);
  }

  private actorObjectId(actorId?: string): Types.ObjectId | undefined {
    return actorId && Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : undefined;
  }

  private async createLedgerEntry(
    payload: {
      studentId: unknown;
      paymentId?: unknown;
      amount: number;
      type: FinancialTransactionType;
      actorId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.financialTransactionsRepository.create({
      studentId: new Types.ObjectId(String(payload.studentId)),
      paymentId: payload.paymentId ? new Types.ObjectId(String(payload.paymentId)) : undefined,
      amount: payload.amount,
      type: payload.type,
      actorId: this.actorObjectId(payload.actorId),
      metadata: payload.metadata ?? {},
    });
  }

  private async runFinancialMutation<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
    if (!this.connection?.readyState) {
      return operation();
    }

    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      return result;
    } catch {
      // Standalone MongoDB deployments do not support multi-document transactions.
      // Keep the state checks and unique ledger index as the safety fallback.
      return operation();
    } finally {
      await session.endSession();
    }
  }

  async create(dto: CreatePaymentDto, actorId?: string) {
    const [student, course, existingPayment] = await Promise.all([
      this.userModel.findById(dto.student).lean().exec(),
      this.courseModel.findById(dto.courseId).lean().exec(),
      this.paymentsRepository.findOne({ student: dto.student, course: dto.courseId }).lean().exec(),
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

    const payment = await this.runFinancialMutation(async () => {
      const created = await this.paymentsRepository.create({
        student: dto.student,
        course: dto.courseId,
        amount: finalPrice,
        isConfirmed: false,
        status: PaymentStatus.Pending,
        method: dto.method,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
      });

      await this.createLedgerEntry({
        studentId: dto.student,
        paymentId: created._id,
        amount: finalPrice,
        type: FinancialTransactionType.PaymentCreated,
        actorId,
        metadata: { courseId: dto.courseId, method: dto.method },
      });

      return created;
    });

    return this.findOne(String(payment._id));
  }

  async createForActor(dto: CreatePaymentDto, actor: AuthenticatedUser) {
    const student = await this.userModel.findById(dto.student).exec();
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.create(dto, actor.userId);
  }

  async findOne(id: string) {
    const payment = await this.paymentsRepository.findById(id).populate(this.paymentPopulate).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return mapPaymentResponse(payment);
  }

  async getAll(query: PaymentsListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);

    const [payments, total] = await Promise.all([
      this.paymentsRepository
        .find(filter)
        .populate(this.paymentPopulate)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.paymentsRepository.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(mapPaymentResponses(payments), total, page, limit);
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
        this.paymentsRepository
          .find(filter)
          .populate(this.paymentPopulate)
          .sort(this.getSort(query))
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.paymentsRepository.countDocuments(filter).exec(),
      ]);

      return createPaginatedResult(mapPaymentResponses(payments), total, page, limit);
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

  async confirmPayment(paymentId: string, actorId?: string) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const existing = await this.paymentsRepository.findById(paymentId).exec();
    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    const status = this.resolveStatus(existing);
    if (status === PaymentStatus.Confirmed) {
      throw new ConflictException('Payment is already confirmed');
    }

    if (status === PaymentStatus.Cancelled) {
      throw new ConflictException('Cancelled payment cannot be confirmed');
    }

    const alreadyLedgered = await this.financialTransactionsRepository
      .exists({ paymentId, type: FinancialTransactionType.PaymentConfirmed })
      .exec();
    if (alreadyLedgered) {
      throw new ConflictException('Payment confirmation was already recorded');
    }

    await this.runFinancialMutation(async () => {
      const confirmedAt = new Date();
      const payment = await this.paymentsRepository
        .findByIdAndUpdate(
          paymentId,
          {
            isConfirmed: true,
            status: PaymentStatus.Confirmed,
            paidAt: existing.paidAt ?? confirmedAt,
            confirmedAt,
          },
          { new: true },
        )
        .exec();

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      await this.createLedgerEntry({
        studentId: payment.student,
        paymentId,
        amount: payment.amount,
        type: FinancialTransactionType.PaymentConfirmed,
        actorId,
      });
    });

    return this.findOne(paymentId);
  }

  async confirmPaymentForActor(paymentId: string, actor: AuthenticatedUser) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const payment = await this.paymentsRepository
      .findById(paymentId)
      .populate({ path: 'student', select: 'username firstName lastName role branchIds' })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const student = payment.student as unknown as UserDocument | null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.confirmPayment(paymentId, actor.userId);
  }

  async cancelPayment(paymentId: string, actorId?: string) {
    if (!Types.ObjectId.isValid(paymentId)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const existing = await this.paymentsRepository.findById(paymentId).exec();
    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    const status = this.resolveStatus(existing);
    if (status === PaymentStatus.Confirmed) {
      throw new ConflictException('Confirmed payment cannot be cancelled');
    }

    if (status === PaymentStatus.Cancelled) {
      throw new ConflictException('Payment is already cancelled');
    }

    await this.runFinancialMutation(async () => {
      const cancelledAt = new Date();
      const payment = await this.paymentsRepository
        .findByIdAndUpdate(
          paymentId,
          { status: PaymentStatus.Cancelled, isConfirmed: false, cancelledAt },
          { new: true },
        )
        .exec();

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      await this.createLedgerEntry({
        studentId: payment.student,
        paymentId,
        amount: payment.amount,
        type: FinancialTransactionType.PaymentCancelled,
        actorId,
      });
    });

    return this.findOne(paymentId);
  }

  async cancelPaymentForActor(paymentId: string, actor: AuthenticatedUser) {
    const payment = await this.paymentsRepository
      .findById(paymentId)
      .populate({ path: 'student', select: 'username firstName lastName role branchIds' })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const student = payment.student as unknown as UserDocument | null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);
    return this.cancelPayment(paymentId, actor.userId);
  }

  async delete(id: string, actorId?: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const existingPayment = await this.paymentsRepository.findById(id).lean().exec();
    if (!existingPayment) {
      throw new NotFoundException('Payment not found');
    }

    const status = this.resolveStatus(existingPayment);
    if (status === PaymentStatus.Confirmed) {
      throw new BadRequestException('Confirmed payments cannot be deleted silently; cancel/reversal flow is required');
    }

    const payment = await this.runFinancialMutation(async () => {
      await this.createLedgerEntry({
        studentId: existingPayment.student,
        paymentId: id,
        amount: existingPayment.amount,
        type: FinancialTransactionType.PaymentDeleted,
        actorId,
        metadata: { previousStatus: status },
      });

      return this.paymentsRepository.findByIdAndDelete(id).exec();
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return true;
  }

  async deleteForActor(id: string, actor: AuthenticatedUser): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid payment ID');
    }

    const payment = await this.paymentsRepository
      .findById(id)
      .populate({ path: 'student', select: 'username firstName lastName role branchIds' })
      .exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const student = payment.student as unknown as UserDocument | null;
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    this.assertActorCanAccessStudent(actor, student);

    return this.delete(id, actor.userId);
  }
}
