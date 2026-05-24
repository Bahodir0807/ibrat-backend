import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import {
  ClientSession,
  Connection,
  FilterQuery,
  Model,
  SortOrder,
  Types,
} from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { PaymentsRepository } from './payments.repository';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import {
  mapPaymentResponse,
  mapPaymentResponses,
} from './dto/payment-response.dto';
import { PaymentStatus } from './payment-status.enum';

type PaymentNotificationType =
  | 'payment_success'
  | 'payment_partial'
  | 'payment_debt'
  | 'payment_overpaid'
  | 'payment_frozen';

type PaymentNotificationContext = {
  studentFullName: string;
  courseName: string;
  groupName: string;
  paymentPeriod: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  paymentMethod?: string;
  status: string;
  comment?: string;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
  ) {}

  private isSystemWideRole(role?: Role): boolean {
    return role === Role.Owner || role === Role.Admin || role === Role.Extra;
  }

  private normalizeBranchIds(branchIds?: unknown[]): string[] {
    return [
      ...new Set(
        (branchIds ?? [])
          .filter((branchId) => branchId !== null && branchId !== undefined)
          .map((branchId) => String(branchId).trim())
          .filter((branchId) => branchId.length > 0),
      ),
    ];
  }

  private ensureScopedActorHasBranches(actor: AuthenticatedUser): string[] {
    const branchIds = this.normalizeBranchIds(actor.branchIds);
    if (!this.isSystemWideRole(actor.role) && branchIds.length === 0) {
      throw new ForbiddenException('User has no assigned branch scope');
    }
    return branchIds;
  }

  private assertActorCanAccessStudent(
    actor: AuthenticatedUser,
    student: Pick<StudentDocument, '_id' | 'branchIds'>,
  ): void {
    if (this.isSystemWideRole(actor.role)) {
      return;
    }

    if (actor.role === Role.Student) {
      if (actor.userId === String(student._id)) {
        return;
      }
      throw new ForbiddenException('Students can only access their own payments');
    }

    if (actor.role === Role.BranchAdmin) {
      const actorBranches = this.ensureScopedActorHasBranches(actor);
      const studentBranches = this.normalizeBranchIds(student.branchIds);
      if (studentBranches.some((branchId) => actorBranches.includes(branchId))) {
        return;
      }
      throw new NotFoundException('Student not found');
    }

    throw new ForbiddenException('You are not allowed to access payments');
  }

  private getSort(query: PaymentsListQueryDto = {}): Record<string, SortOrder> {
    const sortBy =
      query.sortBy && ['createdAt', 'paymentPeriod', 'expectedAmount'].includes(query.sortBy)
        ? query.sortBy
        : 'paymentPeriod';
    const sortOrder: SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    return { [sortBy]: sortOrder };
  }

  private buildFilter(query: PaymentsListQueryDto = {}): FilterQuery<PaymentDocument> {
    const filter: FilterQuery<PaymentDocument> = {};

    if (query.studentId) {
      filter.studentId = new Types.ObjectId(query.studentId);
    }

    if (query.courseId) {
      filter.courseId = new Types.ObjectId(query.courseId);
    }

    if (query.groupId) {
      filter.groupId = new Types.ObjectId(query.groupId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.branchId) {
      filter.branchId = new Types.ObjectId(query.branchId);
    }

    return filter;
  }

  private calculatePaymentPeriod(month: number, year: number): string {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private validatePaymentData(dto: CreatePaymentDto): void {
    // Edge case: negative amount
    if (dto.paidAmount < 0) {
      throw new BadRequestException('Paid amount cannot be negative');
    }

    // Edge case: zero amount
    if (dto.expectedAmount === 0) {
      throw new BadRequestException('Expected amount must be greater than 0');
    }

    // Edge case: invalid student ID
    if (!Types.ObjectId.isValid(dto.studentId)) {
      throw new BadRequestException('Invalid student ID');
    }

    // Edge case: invalid course ID
    if (!Types.ObjectId.isValid(dto.courseId)) {
      throw new BadRequestException('Invalid course ID');
    }

    // Edge case: invalid group ID
    if (!Types.ObjectId.isValid(dto.groupId)) {
      throw new BadRequestException('Invalid group ID');
    }

    // Edge case: invalid branch ID
    if (!Types.ObjectId.isValid(dto.branchId)) {
      throw new BadRequestException('Invalid branch ID');
    }

    // Edge case: invalid month
    if (dto.month < 1 || dto.month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }

    // Edge case: invalid year
    if (dto.year < 2000 || dto.year > 2100) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }
  }

  private calculatePaymentStatus(expectedAmount: number, paidAmount: number): PaymentStatus {
    if (paidAmount === 0) {
      return PaymentStatus.Pending;
    }

    if (paidAmount >= expectedAmount) {
      return PaymentStatus.Paid;
    }

    return PaymentStatus.Partial;
  }

  private async checkDuplicatePayment(
    studentId: string,
    courseId: string,
    month: number,
    year: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.paymentsRepository.findOne({
      studentId: new Types.ObjectId(studentId),
      courseId: new Types.ObjectId(courseId),
      month,
      year,
    });

    if (existing && (!excludeId || existing._id.toString() !== excludeId)) {
      throw new ConflictException(
        `Payment for this student-course-month already exists`,
      );
    }
  }

  private async verifyStudentExists(studentId: string): Promise<StudentDocument> {
    const student = await this.studentModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    return student;
  }

  private async verifyCourseExists(courseId: string): Promise<CourseDocument> {
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  private async verifyGroupExists(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async create(
    dto: CreatePaymentDto,
    actor: AuthenticatedUser,
  ): Promise<any> {
    this.validatePaymentData(dto);

    // Verify student exists
    const student = await this.verifyStudentExists(dto.studentId);

    // Check access
    this.assertActorCanAccessStudent(actor, student);

    // Verify course and group exist
    await this.verifyCourseExists(dto.courseId);
    await this.verifyGroupExists(dto.groupId);

    // Edge case: check duplicate payment
    await this.checkDuplicatePayment(
      dto.studentId,
      dto.courseId,
      dto.month,
      dto.year,
    );

    const paymentPeriod = this.calculatePaymentPeriod(dto.month, dto.year);
    const status = this.calculatePaymentStatus(dto.expectedAmount, dto.paidAmount);
    const remainingAmount = Math.max(0, dto.expectedAmount - dto.paidAmount);
    const overpaidAmount = Math.max(0, dto.paidAmount - dto.expectedAmount);

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const paymentData: Record<string, unknown> = {
        studentId: new Types.ObjectId(dto.studentId),
        courseId: new Types.ObjectId(dto.courseId),
        groupId: new Types.ObjectId(dto.groupId),
        branchId: new Types.ObjectId(dto.branchId),
        month: dto.month,
        year: dto.year,
        paymentPeriod,
        expectedAmount: dto.expectedAmount,
        paidAmount: dto.paidAmount,
        remainingAmount,
        overpaidAmount,
        status,
        isFrozen: false,
        comment: dto.comment,
        paymentHistory: [],
      };

      // Add initial payment history entry if payment was made
      if (dto.paidAmount > 0) {
        paymentData.paymentHistory = [
          {
            amount: dto.paidAmount,
            paidAt: new Date(),
            paymentMethod: (dto.paymentMethod as any) || 'transfer',
            comment: dto.comment,
            createdBy: new Types.ObjectId(actor.userId),
          },
        ];
      }

      const payment = await this.paymentsRepository.create(paymentData, { session });

      await session.commitTransaction();

      return mapPaymentResponse(payment);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async addPayment(
    paymentId: string,
    amount: number,
    method: 'cash' | 'card' | 'transfer',
    actor: AuthenticatedUser,
    comment?: string,
  ): Promise<any> {
    // Edge case: negative amount
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if frozen
    if (payment.isFrozen) {
      if (payment.freezeTo && new Date() < payment.freezeTo) {
        throw new BadRequestException('Payment is frozen and cannot be modified');
      }
      // Auto-unfreeze if freezeTo date has passed
      payment.isFrozen = false;
      payment.freezeReason = undefined;
      payment.freezeFrom = undefined;
      payment.freezeTo = undefined;
    }

    // Edge case: check duplicate payments in same session
    const totalPaid = payment.paidAmount + amount;

    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // Update payment amounts
      const newPaidAmount = payment.paidAmount + amount;
      const newRemainingAmount = Math.max(0, payment.expectedAmount - newPaidAmount);
      const newOverpaidAmount = Math.max(0, newPaidAmount - payment.expectedAmount);

      // Calculate new status
      let newStatus = payment.status;
      if (newPaidAmount === 0) {
        newStatus = PaymentStatus.Pending;
      } else if (newPaidAmount >= payment.expectedAmount) {
        newStatus = newPaidAmount > payment.expectedAmount ? PaymentStatus.Overpaid : PaymentStatus.Paid;
      } else {
        newStatus = PaymentStatus.Partial;
      }

      // Add to payment history
      payment.paymentHistory.push({
        amount,
        paidAt: new Date(),
        paymentMethod: method,
        comment,
        createdBy: new Types.ObjectId(actor.userId),
      });

      payment.paidAmount = newPaidAmount;
      payment.remainingAmount = newRemainingAmount;
      payment.overpaidAmount = newOverpaidAmount;
      payment.status = newStatus;

      const updated = await payment.save({ session });
      await session.commitTransaction();

      return mapPaymentResponse(updated);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async freezePayment(
    paymentId: string,
    reason: string,
    freezeFrom?: Date,
    freezeTo?: Date,
  ): Promise<any> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    payment.isFrozen = true;
    payment.freezeReason = reason;
    payment.freezeFrom = freezeFrom || new Date();
    payment.freezeTo = freezeTo;
    payment.status = PaymentStatus.Frozen;

    const updated = await payment.save();
    return mapPaymentResponse(updated);
  }

  async unfreezePayment(paymentId: string): Promise<any> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (!payment.isFrozen) {
      throw new BadRequestException('Payment is not frozen');
    }

    payment.isFrozen = false;
    payment.freezeReason = undefined;
    payment.freezeFrom = undefined;
    payment.freezeTo = undefined;

    // Restore status based on amounts
    if (payment.paidAmount === 0) {
      payment.status = PaymentStatus.Pending;
    } else if (payment.paidAmount >= payment.expectedAmount) {
      payment.status = payment.paidAmount > payment.expectedAmount ? PaymentStatus.Overpaid : PaymentStatus.Paid;
    } else {
      payment.status = PaymentStatus.Partial;
    }

    const updated = await payment.save();
    return mapPaymentResponse(updated);
  }

  async getAll(
    query: PaymentsListQueryDto = {},
    actor: AuthenticatedUser,
  ): Promise<any> {
    const filter = this.buildFilter(query);

    // Branch filtering for branch admins
    if (actor.role === Role.BranchAdmin) {
      const branchIds = this.ensureScopedActorHasBranches(actor);
      filter.branchId = { $in: branchIds.map(id => new Types.ObjectId(id)) };
    }

    const sort = this.getSort(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.paymentsRepository.find(filter, sort, limit, skip),
      this.paymentsRepository.count(filter),
    ]);

    return createPaginatedResult(
      data.map(p => mapPaymentResponse(p)),
      total,
      page,
      limit,
    );
  }

  async getByStudent(
    studentId: string,
    query: PaymentsListQueryDto = {},
    actor: AuthenticatedUser,
  ): Promise<any> {
    const student = await this.verifyStudentExists(studentId);
    this.assertActorCanAccessStudent(actor, student);

    const filter = { ...this.buildFilter(query), studentId: new Types.ObjectId(studentId) };
    const sort = this.getSort(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.paymentsRepository.find(filter, sort, limit, skip),
      this.paymentsRepository.count(filter),
    ]);

    return createPaginatedResult(
      data.map(p => mapPaymentResponse(p)),
      total,
      page,
      limit,
    );
  }

  async getById(id: string): Promise<any> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return mapPaymentResponse(payment);
  }

  async update(
    id: string,
    dto: Partial<CreatePaymentDto>,
    actor: AuthenticatedUser,
  ): Promise<any> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if can modify
    if (payment.isFrozen && (!payment.freezeTo || new Date() < payment.freezeTo)) {
      throw new BadRequestException('Cannot modify frozen payment');
    }

    // Only allow comment updates on locked payments
    if (payment.status === PaymentStatus.Paid || payment.status === PaymentStatus.Debt) {
      if (Object.keys(dto).some(key => key !== 'comment')) {
        throw new BadRequestException('Cannot modify locked payment');
      }
    }

    const updateData: any = {};
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }

    const updated = await this.paymentsRepository.updateOne(id, updateData);
    return mapPaymentResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Edge case: cannot delete if payment history exists
    if (payment.paymentHistory && payment.paymentHistory.length > 0) {
      throw new BadRequestException('Cannot delete payment with transaction history');
    }

    await this.paymentsRepository.deleteOne(id);
  }

  async getStatistics(actor: AuthenticatedUser, branchId?: string): Promise<any> {
    const filter: any = {};

    if (branchId) {
      filter.branchId = new Types.ObjectId(branchId);
    } else if (actor.role === Role.BranchAdmin) {
      const branchIds = this.ensureScopedActorHasBranches(actor);
      filter.branchId = { $in: branchIds.map(id => new Types.ObjectId(id)) };
    }

    const payments = await this.paymentsRepository.find(filter, {}, 1000, 0);

    const stats = {
      total: payments.length,
      byStatus: {
        pending: payments.filter(p => p.status === PaymentStatus.Pending).length,
        partial: payments.filter(p => p.status === PaymentStatus.Partial).length,
        paid: payments.filter(p => p.status === PaymentStatus.Paid).length,
        debt: payments.filter(p => p.status === PaymentStatus.Debt).length,
        frozen: payments.filter(p => p.status === PaymentStatus.Frozen).length,
        overpaid: payments.filter(p => p.status === PaymentStatus.Overpaid).length,
      },
      totalExpected: payments.reduce((sum, p) => sum + p.expectedAmount, 0),
      totalPaid: payments.reduce((sum, p) => sum + p.paidAmount, 0),
      totalRemaining: payments.reduce((sum, p) => sum + p.remainingAmount, 0),
      totalOverpaid: payments.reduce((sum, p) => sum + p.overpaidAmount, 0),
    };

    return stats;
  }
}
