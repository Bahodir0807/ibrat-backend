import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Statistic, StatisticDocument } from './schemas/statistic.schema';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';

@Injectable()
export class StatisticsService {
  constructor(@InjectModel(Statistic.name) private statisticModel: Model<StatisticDocument>) {}

  async create(dto: CreateStatisticDto) {
    const created = new this.statisticModel({
      ...dto,
      date: new Date(dto.date),
    });
    return serializeResource(await created.save());
  }

  async findAll() {
    const statistics = await this.statisticModel.find().sort({ date: -1 }).exec();
    return serializeResources(statistics);
  }

  async findByType(type: string) {
    const statistics = await this.statisticModel.find({ type }).sort({ date: -1 }).exec();
    return serializeResources(statistics);
  }
}
