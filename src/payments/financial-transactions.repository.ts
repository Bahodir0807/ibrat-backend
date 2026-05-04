import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
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

  create(payload: Record<string, unknown>) {
    return this.transactionModel.create(payload);
  }

  exists(filter: FilterQuery<FinancialTransactionDocument>) {
    return this.transactionModel.exists(filter);
  }

  find(filter: FilterQuery<FinancialTransactionDocument> = {}) {
    return this.transactionModel.find(filter);
  }
}
