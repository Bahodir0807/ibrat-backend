import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, ProjectionType, UpdateQuery } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsRepository {
  constructor(@InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>) {}

  find(filter: FilterQuery<PaymentDocument> = {}, projection?: ProjectionType<PaymentDocument>) {
    return this.paymentModel.find(filter, projection);
  }

  findById(id: unknown, projection?: ProjectionType<PaymentDocument>) {
    return this.paymentModel.findById(id, projection);
  }

  findOne(filter: FilterQuery<PaymentDocument>) {
    return this.paymentModel.findOne(filter);
  }

  countDocuments(filter: FilterQuery<PaymentDocument>) {
    return this.paymentModel.countDocuments(filter);
  }

  create(payload: Record<string, unknown>) {
    return this.paymentModel.create(payload);
  }

  updateById(id: string, payload: UpdateQuery<PaymentDocument>) {
    return this.paymentModel.findByIdAndUpdate(id, payload, { new: true });
  }

  findByIdAndUpdate(id: string, payload: UpdateQuery<PaymentDocument>, options?: Record<string, unknown>) {
    return this.paymentModel.findByIdAndUpdate(id, payload, options);
  }

  deleteById(id: string) {
    return this.paymentModel.findByIdAndDelete(id);
  }

  findByIdAndDelete(id: string) {
    return this.paymentModel.findByIdAndDelete(id);
  }
}
