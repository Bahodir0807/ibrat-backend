import { ForbiddenException, Injectable } from '@nestjs/common';
import { PipelineStage, Types } from 'mongoose';
import {
  ensureActorBranchScope,
  isSystemWideRole,
} from '../common/access/actor-scope';
import { createPaginatedResult } from '../common/responses/paginated-result';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { Role } from '../roles/roles.enum';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationDeliveriesQueryDto } from './dto/notification-deliveries-query.dto';
import {
  mapNotificationDeliveryResponse,
  NotificationDeliveryAggregationRow,
} from './dto/notification-delivery-response.dto';

type DeliveriesFacetResult = {
  items: NotificationDeliveryAggregationRow[];
  total: Array<{ count: number }>;
};

@Injectable()
export class NotificationDeliveriesService {
  constructor(
    private readonly deliveryRepository: NotificationDeliveryRepository,
  ) {}

  async findAllForActor(
    query: NotificationDeliveriesQueryDto,
    actor: AuthenticatedUser,
  ) {
    this.assertCanRead(actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const pipeline = this.buildPipeline(query, actor, page, limit);
    const [result] =
      await this.deliveryRepository.aggregate<DeliveriesFacetResult>(pipeline, {
        allowDiskUse: true,
      });
    const items = (result?.items ?? []).map(mapNotificationDeliveryResponse);
    const total = result?.total?.[0]?.count ?? 0;

    return createPaginatedResult(items, total, page, limit);
  }

  private assertCanRead(actor: AuthenticatedUser): void {
    if (actor.role === Role.Teacher || actor.role === Role.Student) {
      throw new ForbiddenException('Notifications delivery history forbidden');
    }
  }

  private buildPipeline(
    query: NotificationDeliveriesQueryDto,
    actor: AuthenticatedUser,
    page: number,
    limit: number,
  ): PipelineStage[] {
    const baseMatch = this.buildBaseMatch(query);
    const postLookupMatch = this.buildPostLookupMatch(query, actor);
    const searchMatch = this.buildSearchMatch(query.search);
    const pipeline: PipelineStage[] = [];

    if (Object.keys(baseMatch).length > 0) {
      pipeline.push({ $match: baseMatch });
    }

    if (query.branchId || query.courseId) {
      const preLookupFilters: Record<string, unknown>[] = [];
      if (query.branchId) {
        preLookupFilters.push({
          $or: [
            { 'metadata.branchId': query.branchId },
            { 'metadata.branchId': new Types.ObjectId(query.branchId) },
          ],
        });
      }
      if (query.courseId) {
        preLookupFilters.push({
          $or: [
            { 'metadata.courseId': query.courseId },
            { 'metadata.courseId': new Types.ObjectId(query.courseId) },
          ],
        });
      }
      pipeline.push({ $match: { $and: preLookupFilters } });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      {
        $unwind: {
          path: '$student',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'payments',
          localField: 'paymentId',
          foreignField: '_id',
          as: 'payment',
        },
      },
      {
        $unwind: {
          path: '$payment',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          studentName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$student.firstName', ''] },
                  ' ',
                  { $ifNull: ['$student.lastName', ''] },
                ],
              },
            },
          },
          studentNumber: '$student.studentNumber',
        },
      },
    );

    // Рекомендуется перенести этот Match выше, если фильтры не зависят от полей lookup
    if (postLookupMatch.length > 0) {
      pipeline.push({ $match: { $and: postLookupMatch } });
    }

    if (searchMatch) {
      pipeline.push({ $match: searchMatch });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } }, // Упростили сортировку для лучшего использования индексов
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                type: 1,
                channel: 1,
                paymentId: 1,
                studentId: 1,
                studentName: 1,
                studentNumber: 1,
                recipientType: 1,
                phone: 1,
                message: 1,
                status: 1,
                providerMessageId: 1,
                error: 1,
                dateKey: 1,
                metadata: 1,
                createdAt: 1,
                sentAt: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    );

    return pipeline;
  }

  private buildBaseMatch(query: NotificationDeliveriesQueryDto) {
    const match: Record<string, unknown> = {};

    const {
      type,
      channel,
      status,
      recipientType,
      studentId,
      paymentId,
      phone,
      dateFrom,
      dateTo,
    } = query;

    if (type) match.type = type;
    if (channel) match.channel = channel;
    if (status) match.status = status;
    if (recipientType) match.recipientType = recipientType;
    if (studentId) match.studentId = new Types.ObjectId(studentId);
    if (paymentId) match.paymentId = new Types.ObjectId(paymentId);
    if (phone) match.phone = this.regex(phone);

    if (dateFrom || dateTo) {
      match.createdAt = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lte: dateTo } : {}),
      };
    }

    return match;
  }

  private buildPostLookupMatch(
    query: NotificationDeliveriesQueryDto,
    actor: AuthenticatedUser,
  ): Record<string, unknown>[] {
    const filters: Record<string, unknown>[] = [];

    if (!isSystemWideRole(actor.role)) {
      const actorBranchIds = ensureActorBranchScope(actor);
      filters.push(this.branchScopeFilter(actorBranchIds));
    }

    if (query.branchId) {
      filters.push(this.branchScopeFilter([query.branchId]));
    }

    if (query.courseId) {
      filters.push(this.courseScopeFilter(query.courseId));
    }

    return filters;
  }

  private branchScopeFilter(branchIds: string[]) {
    const validObjectIds = branchIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    return {
      $or: [
        { 'metadata.branchId': { $in: branchIds } },
        { 'metadata.branchId': { $in: validObjectIds } },
        { 'payment.branchId': { $in: validObjectIds } },
        { 'student.branchIds': { $in: validObjectIds } },
      ],
    };
  }

  private courseScopeFilter(courseId: string) {
    const objectId = new Types.ObjectId(courseId);

    return {
      $or: [
        { 'metadata.courseId': courseId },
        { 'metadata.courseId': objectId },
        { 'payment.courseId': objectId },
      ],
    };
  }

  private buildSearchMatch(search?: string) {
    if (!search?.trim()) {
      return undefined;
    }

    const regex = this.regex(search);
    return {
      $or: [
        { phone: regex },
        { message: regex },
        { error: regex },
        { studentName: regex },
        { studentNumber: regex },
      ],
    };
  }

  private regex(value: string): RegExp {
    return new RegExp(this.escapeRegex(value.trim()), 'i');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
