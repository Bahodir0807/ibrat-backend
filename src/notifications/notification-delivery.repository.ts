import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  NotificationDelivery,
  NotificationDeliveryDocument,
} from './schemas/notification-delivery.schema';

@Injectable()
export class NotificationDeliveryRepository {
  constructor(
    @InjectModel(NotificationDelivery.name)
    private readonly deliveryModel: Model<NotificationDeliveryDocument>,
  ) {}

  create(payload: Record<string, unknown>) {
    return this.deliveryModel.create(payload);
  }

  count(filter: FilterQuery<NotificationDeliveryDocument>) {
    return this.deliveryModel.countDocuments(filter);
  }
}
