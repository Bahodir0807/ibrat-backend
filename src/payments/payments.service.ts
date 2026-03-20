import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Course, CourseDocument } from '../courses/schemas/course.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
  ) {}

  async create(dto: CreatePaymentDto): Promise<Payment> {
    const course = await this.courseModel.findById(dto.courseId).lean();
    if (!course || typeof course.price !== 'number') {
      throw new BadRequestException('Course not found or course price is invalid');
    }

    const coursesOfStudent = await this.courseModel.find({ students: dto.student }).lean();
    const hasMultipleCourses = coursesOfStudent.length > 1;
    const finalPrice = hasMultipleCourses ? Math.round(course.price * 0.9) : course.price;

    return this.paymentModel.create({
      student: dto.student,
      course: dto.courseId,
      amount: finalPrice,
      isConfirmed: false,
      paidAt: dto.paidAt ?? new Date(),
    });
  }

  async getAll(): Promise<Payment[]> {
    return this.paymentModel.find().populate('student course').sort({ createdAt: -1 }).exec();
  }

  async getByStudent(studentId: string): Promise<Payment[]> {
    return this.paymentModel
      .find({ student: studentId })
      .populate('course')
      .sort({ createdAt: -1 })
      .exec();
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentModel
      .findByIdAndUpdate(paymentId, { isConfirmed: true }, { new: true })
      .populate('student course');

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async delete(id: string): Promise<void> {
    await this.paymentModel.findByIdAndDelete(id);
  }
}
