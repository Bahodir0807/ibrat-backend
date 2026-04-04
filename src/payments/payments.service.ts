import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
  ) {}

  private readonly paymentPopulate = [
    { path: 'student', select: 'username firstName lastName role email phoneNumber' },
    { path: 'course', select: 'name description price teacherId' },
  ];

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
    const course = await this.courseModel.findById(dto.courseId).lean();
    if (!course || typeof course.price !== 'number') {
      throw new BadRequestException('Course not found or course price is invalid');
    }

    const coursesOfStudent = await this.courseModel.find({ students: dto.student }).lean();
    const hasMultipleCourses = coursesOfStudent.length > 1;
    const finalPrice = hasMultipleCourses ? Math.round(course.price * 0.9) : course.price;

    const payment = await this.paymentModel.create({
      student: dto.student,
      course: dto.courseId,
      amount: finalPrice,
      isConfirmed: false,
      paidAt: dto.paidAt ?? new Date(),
    });

    return this.findOne(String(payment._id));
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

    const payments = await this.paymentModel
      .find(this.buildFilter(query))
      .populate(this.paymentPopulate)
      .sort(this.getSort(query))
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return serializeResources(payments);
  }

  async getByStudent(studentId: string, query: PaymentsListQueryDto = {}) {
    return this.getAll({ ...query, studentId });
  }

  async confirmPayment(paymentId: string) {
    const payment = await this.paymentModel
      .findByIdAndUpdate(paymentId, { isConfirmed: true }, { new: true })
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.findOne(paymentId);
  }

  async delete(id: string): Promise<boolean> {
    const payment = await this.paymentModel.findByIdAndDelete(id).exec();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return true;
  }
}
