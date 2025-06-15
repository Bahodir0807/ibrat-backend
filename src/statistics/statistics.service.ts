import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Statistic, StatisticDocument } from './schemas/statistic.schema';
import { CreateStatisticDto } from './dto/create-statistic.dto';

@Injectable()
export class StatisticsService {
  constructor(@InjectModel(Statistic.name) private statisticModel: Model<StatisticDocument>) {}

  async create(dto: CreateStatisticDto) {
    const created = new this.statisticModel(dto);
    return created.save();
  }

  async findAll() {
    return this.statisticModel.find().exec();
  }

  async findByType(type: string) {
    return this.statisticModel.find({ type }).exec();
  }
}
