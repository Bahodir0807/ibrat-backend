import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PhoneRequest, PhoneRequestDocument } from './schemas/phone-request.schema';
import { CreatePhoneRequestDto } from './dto/create-phone-request.dto';
import { HandlePhoneRequestDto } from './dto/handle-phone-request.dto';

@Injectable()
export class PhoneRequestService {
  constructor(
    @InjectModel(PhoneRequest.name)
    private phoneRequestModel: Model<PhoneRequestDocument>
  ) {}

  async create(dto: CreatePhoneRequestDto): Promise<PhoneRequest> {
    const created = new this.phoneRequestModel(dto);
    return created.save();
  }

  async handle(dto: HandlePhoneRequestDto): Promise<PhoneRequest> {
    const request = await this.phoneRequestModel.findById(dto.requestId);
    if (!request) throw new NotFoundException('Заявка не найдена');

    request.status = dto.status;
    request.updatedAt = new Date();
    return request.save();
  }

  async getById(id: string) {
    return this.phoneRequestModel.findById(id);
  }

  async getPending(): Promise<PhoneRequest[]> {
    return this.phoneRequestModel.find({ status: 'pending' });
  }

  async updateName(id: string, name: string) {
    return this.phoneRequestModel.findByIdAndUpdate(id, { name });
  }
}
