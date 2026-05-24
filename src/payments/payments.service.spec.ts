import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './payment-status.enum';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

function objectId(): string {
  return new Types.ObjectId().toString();
}

function createActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: objectId(),
    role: Role.Admin,
    branchIds: [objectId()],
    ...overrides,
  };
}

function createSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
}

function createPaymentDoc(overrides: Record<string, unknown> = {}) {
  const payment = {
    _id: new Types.ObjectId(),
    studentId: new Types.ObjectId(objectId()),
    courseId: new Types.ObjectId(objectId()),
    groupId: new Types.ObjectId(objectId()),
    branchId: new Types.ObjectId(objectId()),
    month: 5,
    year: 2026,
    paymentPeriod: '2026-05',
    expectedAmount: 100,
    paidAmount: 0,
    remainingAmount: 100,
    overpaidAmount: 0,
    status: PaymentStatus.Pending,
    isFrozen: false,
    paymentHistory: [] as Array<Record<string, unknown>>,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    ...overrides,
  };

  (payment.save as jest.Mock).mockImplementation(async () => payment);
  return payment;
}

function createService() {
  const session = createSession();
  const paymentsRepository = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const connection = {
    startSession: jest.fn(async () => session),
  };
  const courseModel = { findById: jest.fn() };
  const studentModel = { findById: jest.fn() };
  const groupModel = { findById: jest.fn() };

  return {
    service: new PaymentsService(
      paymentsRepository as any,
      connection as any,
      courseModel as any,
      studentModel as any,
      groupModel as any,
    ),
    paymentsRepository,
    connection,
    session,
    courseModel,
    studentModel,
    groupModel,
  };
}

describe('PaymentsService', () => {
  describe('create', () => {
    it('creates payment with pending status and correct amounts', async () => {
      const { service, paymentsRepository, studentModel, courseModel, groupModel } = createService();
      const studentId = objectId();
      const courseId = objectId();
      const groupId = objectId();
      const branchId = objectId();
      const actor = createActor();

      studentModel.findById.mockResolvedValue({ _id: studentId, branchIds: [branchId] });
      courseModel.findById.mockResolvedValue({ _id: courseId });
      groupModel.findById.mockResolvedValue({ _id: groupId });
      paymentsRepository.findOne.mockResolvedValue(null);

      const created = createPaymentDoc({
        studentId: new Types.ObjectId(studentId),
        courseId: new Types.ObjectId(courseId),
        groupId: new Types.ObjectId(groupId),
        branchId: new Types.ObjectId(branchId),
        expectedAmount: 200,
        paidAmount: 0,
        remainingAmount: 200,
        overpaidAmount: 0,
        status: PaymentStatus.Pending,
        paymentHistory: [],
      });
      paymentsRepository.create.mockResolvedValue(created);

      const result = await service.create(
        {
          studentId,
          courseId,
          groupId,
          branchId,
          month: 5,
          year: 2026,
          expectedAmount: 200,
          paidAmount: 0,
        },
        actor,
      );

      expect(result.status).toBe(PaymentStatus.Pending);
      expect(result.remainingAmount).toBe(200);
      expect(result.overpaidAmount).toBe(0);
      expect(result.paymentHistory).toHaveLength(0);
    });

    it('creates payment with partial status and initial paymentHistory', async () => {
      const { service, paymentsRepository, studentModel, courseModel, groupModel } = createService();
      const studentId = objectId();
      const courseId = objectId();
      const groupId = objectId();
      const branchId = objectId();
      const actor = createActor();

      studentModel.findById.mockResolvedValue({ _id: studentId, branchIds: [branchId] });
      courseModel.findById.mockResolvedValue({ _id: courseId });
      groupModel.findById.mockResolvedValue({ _id: groupId });
      paymentsRepository.findOne.mockResolvedValue(null);

      const created = createPaymentDoc({
        studentId: new Types.ObjectId(studentId),
        courseId: new Types.ObjectId(courseId),
        groupId: new Types.ObjectId(groupId),
        branchId: new Types.ObjectId(branchId),
        expectedAmount: 100,
        paidAmount: 40,
        remainingAmount: 60,
        overpaidAmount: 0,
        status: PaymentStatus.Partial,
        paymentHistory: [
          {
            amount: 40,
            paidAt: new Date(),
            paymentMethod: 'cash',
            createdBy: new Types.ObjectId(actor.userId),
          },
        ],
      });
      paymentsRepository.create.mockResolvedValue(created);

      const result = await service.create(
        {
          studentId,
          courseId,
          groupId,
          branchId,
          month: 5,
          year: 2026,
          expectedAmount: 100,
          paidAmount: 40,
          paymentMethod: 'cash',
        },
        actor,
      );

      expect(result.status).toBe(PaymentStatus.Partial);
      expect(result.remainingAmount).toBe(60);
      expect(result.overpaidAmount).toBe(0);
      expect(result.paymentHistory).toHaveLength(1);
      expect(result.paymentHistory[0].amount).toBe(40);
    });

    it('creates payment with paid status when paidAmount equals expectedAmount', async () => {
      const { service, paymentsRepository, studentModel, courseModel, groupModel } = createService();
      const studentId = objectId();
      const courseId = objectId();
      const groupId = objectId();
      const branchId = objectId();
      const actor = createActor();

      studentModel.findById.mockResolvedValue({ _id: studentId, branchIds: [branchId] });
      courseModel.findById.mockResolvedValue({ _id: courseId });
      groupModel.findById.mockResolvedValue({ _id: groupId });
      paymentsRepository.findOne.mockResolvedValue(null);
      paymentsRepository.create.mockResolvedValue(
        createPaymentDoc({
          expectedAmount: 100,
          paidAmount: 100,
          remainingAmount: 0,
          overpaidAmount: 0,
          status: PaymentStatus.Paid,
        }),
      );

      const result = await service.create(
        {
          studentId,
          courseId,
          groupId,
          branchId,
          month: 5,
          year: 2026,
          expectedAmount: 100,
          paidAmount: 100,
        },
        actor,
      );

      expect(result.status).toBe(PaymentStatus.Paid);
      expect(result.remainingAmount).toBe(0);
      expect(result.overpaidAmount).toBe(0);
    });

    it('calculates overpaidAmount while keeping status as paid on create', async () => {
      const { service, paymentsRepository, studentModel, courseModel, groupModel } = createService();
      const studentId = objectId();
      const courseId = objectId();
      const groupId = objectId();
      const branchId = objectId();
      const actor = createActor();

      studentModel.findById.mockResolvedValue({ _id: studentId, branchIds: [branchId] });
      courseModel.findById.mockResolvedValue({ _id: courseId });
      groupModel.findById.mockResolvedValue({ _id: groupId });
      paymentsRepository.findOne.mockResolvedValue(null);
      paymentsRepository.create.mockResolvedValue(
        createPaymentDoc({
          expectedAmount: 100,
          paidAmount: 130,
          remainingAmount: 0,
          overpaidAmount: 30,
          status: PaymentStatus.Paid,
        }),
      );

      const result = await service.create(
        {
          studentId,
          courseId,
          groupId,
          branchId,
          month: 5,
          year: 2026,
          expectedAmount: 100,
          paidAmount: 130,
        },
        actor,
      );

      expect(result.status).toBe(PaymentStatus.Paid);
      expect(result.remainingAmount).toBe(0);
      expect(result.overpaidAmount).toBe(30);
    });

    it('throws on invalid studentId', async () => {
      const { service } = createService();
      const actor = createActor();

      await expect(
        service.create(
          {
            studentId: 'bad-id',
            courseId: objectId(),
            groupId: objectId(),
            branchId: objectId(),
            month: 5,
            year: 2026,
            expectedAmount: 100,
            paidAmount: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws on invalid courseId/groupId/branchId', async () => {
      const { service } = createService();
      const actor = createActor();

      await expect(
        service.create(
          {
            studentId: objectId(),
            courseId: 'bad-id',
            groupId: objectId(),
            branchId: objectId(),
            month: 5,
            year: 2026,
            expectedAmount: 100,
            paidAmount: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.create(
          {
            studentId: objectId(),
            courseId: objectId(),
            groupId: 'bad-id',
            branchId: objectId(),
            month: 5,
            year: 2026,
            expectedAmount: 100,
            paidAmount: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.create(
          {
            studentId: objectId(),
            courseId: objectId(),
            groupId: objectId(),
            branchId: 'bad-id',
            month: 5,
            year: 2026,
            expectedAmount: 100,
            paidAmount: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when expectedAmount is zero', async () => {
      const { service } = createService();
      const actor = createActor();

      await expect(
        service.create(
          {
            studentId: objectId(),
            courseId: objectId(),
            groupId: objectId(),
            branchId: objectId(),
            month: 5,
            year: 2026,
            expectedAmount: 0,
            paidAmount: 0,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when paidAmount is negative', async () => {
      const { service } = createService();
      const actor = createActor();

      await expect(
        service.create(
          {
            studentId: objectId(),
            courseId: objectId(),
            groupId: objectId(),
            branchId: objectId(),
            month: 5,
            year: 2026,
            expectedAmount: 100,
            paidAmount: -1,
          },
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('addPayment', () => {
    it('updates to full payment and keeps history entries', async () => {
      const { service, paymentsRepository } = createService();
      const actor = createActor();
      const payment = createPaymentDoc({
        expectedAmount: 100,
        paidAmount: 40,
        remainingAmount: 60,
        overpaidAmount: 0,
        status: PaymentStatus.Partial,
        paymentHistory: [
          {
            amount: 40,
            paidAt: new Date('2026-05-01T00:00:00.000Z'),
            paymentMethod: 'cash',
            createdBy: new Types.ObjectId(actor.userId),
          },
        ],
      });

      paymentsRepository.findById.mockResolvedValue(payment);

      const result = await service.addPayment(payment._id.toString(), 60, 'card', actor, 'rest');

      expect(result.status).toBe(PaymentStatus.Paid);
      expect(result.paidAmount).toBe(100);
      expect(result.remainingAmount).toBe(0);
      expect(result.overpaidAmount).toBe(0);
      expect(result.paymentHistory).toHaveLength(2);
      expect(result.paymentHistory[0].amount).toBe(40);
      expect(result.paymentHistory[1].amount).toBe(60);
    });

    it('sets overpaid status and overpaidAmount on overpayment', async () => {
      const { service, paymentsRepository } = createService();
      const actor = createActor();
      const payment = createPaymentDoc({
        expectedAmount: 100,
        paidAmount: 90,
        remainingAmount: 10,
        status: PaymentStatus.Partial,
      });
      paymentsRepository.findById.mockResolvedValue(payment);

      const result = await service.addPayment(payment._id.toString(), 20, 'transfer', actor);

      expect(result.status).toBe(PaymentStatus.Overpaid);
      expect(result.paidAmount).toBe(110);
      expect(result.remainingAmount).toBe(0);
      expect(result.overpaidAmount).toBe(10);
    });

    it('rejects zero and negative addPayment amount', async () => {
      const { service } = createService();
      const actor = createActor();

      await expect(
        service.addPayment(objectId(), 0, 'cash', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.addPayment(objectId(), -10, 'cash', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects payment changes when payment is frozen', async () => {
      const { service, paymentsRepository } = createService();
      const actor = createActor();
      const payment = createPaymentDoc({
        isFrozen: true,
        freezeTo: new Date(Date.now() + 60_000),
      });
      paymentsRepository.findById.mockResolvedValue(payment);

      await expect(
        service.addPayment(payment._id.toString(), 10, 'cash', actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('freezePayment', () => {
    it('sets payment status to frozen', async () => {
      const { service, paymentsRepository } = createService();
      const payment = createPaymentDoc();
      paymentsRepository.findById.mockResolvedValue(payment);

      const result = await service.freezePayment(payment._id.toString(), 'manual hold');

      expect(result.status).toBe(PaymentStatus.Frozen);
      expect(result.isFrozen).toBe(true);
      expect(result.freezeReason).toBe('manual hold');
    });

    it('throws for missing payment', async () => {
      const { service, paymentsRepository } = createService();
      paymentsRepository.findById.mockResolvedValue(null);
      await expect(service.freezePayment(objectId(), 'reason')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
