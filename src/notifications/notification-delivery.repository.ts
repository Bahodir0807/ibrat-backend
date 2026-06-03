import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage } from 'mongoose';
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

  aggregate<T = Record<string, unknown>>(
    pipeline: PipelineStage[],
    options?: { allowDiskUse?: boolean },
  ) {
    const query = this.deliveryModel.aggregate<T>(pipeline);
    if (options?.allowDiskUse) {
      query.allowDiskUse(true);
    }
    return query.exec();
  }
}
