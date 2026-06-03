import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { NotificationDeliveryRepository } from './notification-delivery.repository';

function objectId(): string {
  return new Types.ObjectId().toHexString();
}

function actor(role: Role, branchIds: string[] = []): AuthenticatedUser {
  return { userId: objectId(), role, branchIds };
}

function createRepositoryMock() {
  return {
    aggregate: jest.fn(async () => [
      {
        items: [
          {
            _id: new Types.ObjectId(),
            type: 'debt_sms',
            channel: 'sms',
            paymentId: new Types.ObjectId(),
            studentId: new Types.ObjectId(),
            studentName: 'Ali Valiyev',
            studentNumber: 'ST-1',
            recipientType: 'student',
            phone: '+99890',
            message: 'Localized message',
            status: 'dry_run',
            providerMessageId: 'mock-id',
            providerResponse: { secret: true },
            error: undefined,
            dateKey: '2026-06-04',
            metadata: { branchId: objectId(), courseId: objectId() },
            createdAt: new Date('2026-06-04T10:00:00.000Z'),
            sentAt: undefined,
          },
        ],
        total: [{ count: 1 }],
      },
    ]),
  };
}

function pipelineText(repository: ReturnType<typeof createRepositoryMock>) {
  const calls = repository.aggregate.mock.calls as unknown as Array<
    [unknown[]]
  >;
  return JSON.stringify(calls[0][0]);
}

describe('NotificationDeliveriesService', () => {
  it('allows owner to list all deliveries without branch scope', async () => {
    const repository = createRepositoryMock();
    const service = new NotificationDeliveriesService(
      repository as unknown as NotificationDeliveryRepository,
    );

    const result = await service.findAllForActor({}, actor(Role.Owner));

    expect(repository.aggregate).toHaveBeenCalledWith(expect.any(Array), {
      allowDiskUse: true,
    });
    expect(pipelineText(repository)).not.toContain('metadata.branchId');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('providerResponse');
  });

  it('limits admin deliveries to assigned branch scope', async () => {
    const branchId = objectId();
    const repository = createRepositoryMock();
    const service = new NotificationDeliveriesService(
      repository as unknown as NotificationDeliveryRepository,
    );

    await service.findAllForActor({}, actor(Role.Admin, [branchId]));

    const text = pipelineText(repository);
    expect(text).toContain(branchId);
    expect(text).toContain('metadata.branchId');
    expect(text).toContain('payment.branchId');
    expect(text).toContain('student.branchIds');
  });

  it.each([Role.Teacher, Role.Student])(
    'forbids %s from delivery history',
    async (role) => {
      const repository = createRepositoryMock();
      const service = new NotificationDeliveriesService(
        repository as unknown as NotificationDeliveryRepository,
      );

      await expect(
        service.findAllForActor({}, actor(role, [objectId()])),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.aggregate).not.toHaveBeenCalled();
    },
  );

  it('applies status, type, channel, date and id filters', async () => {
    const repository = createRepositoryMock();
    const service = new NotificationDeliveriesService(
      repository as unknown as NotificationDeliveryRepository,
    );
    const studentId = objectId();
    const paymentId = objectId();

    await service.findAllForActor(
      {
        type: 'debt_sms',
        channel: 'sms',
        status: 'failed',
        studentId,
        paymentId,
        dateFrom: new Date('2026-06-01T00:00:00.000Z'),
        dateTo: new Date('2026-06-04T23:59:59.999Z'),
      },
      actor(Role.Owner),
    );

    const calls = repository.aggregate.mock.calls as unknown as Array<
      [unknown[]]
    >;
    const firstMatch = calls[0][0][0];
    expect(firstMatch).toEqual({
      $match: expect.objectContaining({
        type: 'debt_sms',
        channel: 'sms',
        status: 'failed',
        studentId: expect.any(Types.ObjectId),
        paymentId: expect.any(Types.ObjectId),
        createdAt: {
          $gte: new Date('2026-06-01T00:00:00.000Z'),
          $lte: new Date('2026-06-04T23:59:59.999Z'),
        },
      }),
    });
  });

  it('applies pagination in aggregation facet', async () => {
    const repository = createRepositoryMock();
    const service = new NotificationDeliveriesService(
      repository as unknown as NotificationDeliveryRepository,
    );

    const result = await service.findAllForActor(
      { page: 3, limit: 10 },
      actor(Role.Owner),
    );

    const text = pipelineText(repository);
    expect(text).toContain('"$skip":20');
    expect(text).toContain('"$limit":10');
    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('applies search, branch and course filters after lookup', async () => {
    const repository = createRepositoryMock();
    const service = new NotificationDeliveriesService(
      repository as unknown as NotificationDeliveryRepository,
    );
    const branchId = objectId();
    const courseId = objectId();

    await service.findAllForActor(
      { search: 'Ali', branchId, courseId },
      actor(Role.Owner),
    );

    const text = pipelineText(repository);
    expect(text).toContain(branchId);
    expect(text).toContain(courseId);
    expect(text).toContain('studentName');
    expect(text).toContain('studentNumber');
  });
});
