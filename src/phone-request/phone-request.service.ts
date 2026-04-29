import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, SortOrder } from 'mongoose';
import { PhoneRequest, PhoneRequestDocument } from './schemas/phone-request.schema';
import { CreatePhoneRequestDto } from './dto/create-phone-request.dto';
import { HandlePhoneRequestDto } from './dto/handle-phone-request.dto';
import { PhoneRequestListQueryDto } from './dto/phone-request-list-query.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';
import { createPaginatedResult } from '../common/responses/paginated-result';

@Injectable()
export class PhoneRequestService {
  constructor(
    @InjectModel(PhoneRequest.name)
    private readonly phoneRequestModel: Model<PhoneRequestDocument>,
  ) {}

  private getSort(query: PhoneRequestListQueryDto) {
    const sortBy = query.sortBy && ['createdAt', 'updatedAt', 'status'].includes(query.sortBy)
      ? query.sortBy
      : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    return { [sortBy]: sortOrder as SortOrder };
  }

  private buildFilter(query: PhoneRequestListQueryDto = {}): FilterQuery<PhoneRequestDocument> {
    const filter: FilterQuery<PhoneRequestDocument> = {};

    if (query.telegramId) {
      filter.telegramId = query.telegramId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search?.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { phone: regex },
        { name: regex },
        { telegramId: regex },
      ];
    }

    return filter;
  }

  async create(dto: CreatePhoneRequestDto) {
    const existing = await this.phoneRequestModel.findOne({ telegramId: dto.telegramId }).exec();

    if (existing && existing.status === 'pending') {
      existing.phone = dto.phone;
      existing.name = dto.name;
      existing.updatedAt = new Date();
      await existing.save();
      return serializeResource(existing);
    }

    const created = new this.phoneRequestModel({
      ...dto,
      status: 'pending',
      updatedAt: new Date(),
    });

    return serializeResource(await created.save());
  }

  async handle(dto: HandlePhoneRequestDto) {
    const request = await this.phoneRequestModel.findById(dto.requestId).exec();
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    request.status = dto.status;
    request.updatedAt = new Date();
    return serializeResource(await request.save());
  }

  async getByTelegramId(telegramId: string) {
    if (!telegramId) {
      throw new BadRequestException('telegramId is required');
    }

    const request = await this.findByTelegramIdOptional(telegramId);
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return request;
  }

  async findByTelegramIdOptional(telegramId: string) {
    if (!telegramId) {
      throw new BadRequestException('telegramId is required');
    }

    const request = await this.phoneRequestModel.findOne({ telegramId }).exec();
    return request ? serializeResource(request) : null;
  }

  async getById(id: string) {
    const request = await this.phoneRequestModel.findById(id).exec();
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    return serializeResource(request);
  }

  async findAll(query: PhoneRequestListQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query);

    const [requests, total] = await Promise.all([
      this.phoneRequestModel
        .find(filter)
        .sort(this.getSort(query))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.phoneRequestModel.countDocuments(filter).exec(),
    ]);

    return createPaginatedResult(serializeResources(requests), total, page, limit);
  }

  async getPending(query: PhoneRequestListQueryDto = {}) {
    return this.findAll({ ...query, status: 'pending' });
  }

  async updateName(id: string, name: string) {
    const updated = await this.phoneRequestModel.findByIdAndUpdate(
      id,
      { name, updatedAt: new Date() },
      { new: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('Request not found');
    }

    return serializeResource(updated);
  }
}
