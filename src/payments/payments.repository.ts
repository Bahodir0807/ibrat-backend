import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  FilterQuery,
  Model,
  ProjectionType,
  QueryOptions,
  SaveOptions,
  UpdateQuery,
  SortOrder,
} from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  find(
    filter: FilterQuery<PaymentDocument> = {},
    sort?: Record<string, SortOrder>,
    limit?: number,
    skip?: number,
    projection?: ProjectionType<PaymentDocument>,
  ) {
    let query = this.paymentModel.find(filter, projection);
    
    if (sort) {
      query = query.sort(sort);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return query.exec();
  }

  findById(id: unknown, projection?: ProjectionType<PaymentDocument>) {
    return this.paymentModel.findById(id, projection);
  }

  findOne(filter: FilterQuery<PaymentDocument>) {
    return this.paymentModel.findOne(filter);
  }

  count(filter: FilterQuery<PaymentDocument>) {
    return this.paymentModel.countDocuments(filter);
  }

  countDocuments(filter: FilterQuery<PaymentDocument>) {
    return this.paymentModel.countDocuments(filter);
  }

  async create(payload: Record<string, unknown>, options?: SaveOptions) {
    if (options?.session) {
      const [created] = await this.paymentModel.create([payload], options);
      return created;
    }

    return this.paymentModel.create(payload);
  }

  updateOne(id: string, payload: UpdateQuery<PaymentDocument>) {
    return this.paymentModel.findByIdAndUpdate(id, payload, { new: true });
  }

  updateById(id: string, payload: UpdateQuery<PaymentDocument>) {
    return this.paymentModel.findByIdAndUpdate(id, payload, { new: true });
  }

  findByIdAndUpdate(
    id: string,
    payload: UpdateQuery<PaymentDocument>,
    options?: Record<string, unknown>,
  ) {
    return this.paymentModel.findByIdAndUpdate(id, payload, options);
  }

  findOneAndUpdate(
    filter: FilterQuery<PaymentDocument>,
    payload: UpdateQuery<PaymentDocument>,
    options?: QueryOptions<PaymentDocument>,
  ) {
    return this.paymentModel.findOneAndUpdate(filter, payload, options);
  }

  deleteById(id: string) {
    return this.paymentModel.findByIdAndDelete(id);
  }

  deleteOne(id: string) {
    return this.paymentModel.findByIdAndDelete(id);
  }

  findByIdAndDelete(id: string, options?: QueryOptions<PaymentDocument>) {
    return this.paymentModel.findByIdAndDelete(id, options);
  }
}
