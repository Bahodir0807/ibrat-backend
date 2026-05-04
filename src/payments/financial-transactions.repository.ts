import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SaveOptions } from 'mongoose';
import {
  FinancialTransaction,
  FinancialTransactionDocument,
} from './schemas/financial-transaction.schema';

@Injectable()
export class FinancialTransactionsRepository {
  constructor(
    @InjectModel(FinancialTransaction.name)
    private readonly transactionModel: Model<FinancialTransactionDocument>,
  ) {}

  async create(payload: Record<string, unknown>, options?: SaveOptions) {
    if (options?.session) {
      const [created] = await this.transactionModel.create([payload], options);
      return created;
    }

    return this.transactionModel.create(payload);
  }

  exists(filter: FilterQuery<FinancialTransactionDocument>) {
    return this.transactionModel.exists(filter);
  }

  find(filter: FilterQuery<FinancialTransactionDocument> = {}) {
    return this.transactionModel.find(filter);
  }
}
