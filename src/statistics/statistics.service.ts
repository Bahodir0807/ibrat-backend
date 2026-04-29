import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Statistic, StatisticDocument } from './schemas/statistic.schema';
import { CreateStatisticDto } from './dto/create-statistic.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { StatisticsListQueryDto } from './dto/statistics-list-query.dto';
import { createPaginatedResult } from '../common/responses/paginated-result';

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

  async findAll(query: StatisticsListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = query.type?.trim() ? { type: query.type.trim() } : {};

    const [statistics, total] = await Promise.all([
      this.statisticModel.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.statisticModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(statistics), total, page, limit);
  }

  async findByType(type: string, query: StatisticsListQueryDto = {}) {
    return this.findAll({ ...query, type });
  }
}
