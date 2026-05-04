import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './payment-status.enum';
import { FinancialTransactionType } from './financial-transaction-type.enum';
import { Role } from '../roles/roles.enum';

function objectId() {
  return new Types.ObjectId().toString();
}

function chain<T>(result: T) {
  const query: Record<string, jest.Mock> = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn(async () => result),
  };
  return query;
}

function createService(overrides: {
  paymentsRepository?: Record<string, jest.Mock>;
  financialTransactionsRepository?: Record<string, jest.Mock>;
  courseModel?: Record<string, jest.Mock>;
  userModel?: Record<string, jest.Mock>;
} = {}) {
  const paymentsRepository = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    ...overrides.paymentsRepository,
  };
  const financialTransactionsRepository = {
    create: jest.fn(),
    exists: jest.fn(),
    ...overrides.financialTransactionsRepository,
  };
  const courseModel = {
    findById: jest.fn(),
    find: jest.fn(),
    ...overrides.courseModel,
  };
  const userModel = {
    findById: jest.fn(),
    find: jest.fn(),
    ...overrides.userModel,
  };

  return {
    service: new PaymentsService(
      paymentsRepository as any,
      financialTransactionsRepository as any,
      { readyState: 0 } as any,
      courseModel as any,
      userModel as any,
    ),
    paymentsRepository,
    financialTransactionsRepository,
    courseModel,
    userModel,
  };
}

describe('PaymentsService financial integrity', () => {
  it('cannot confirm a payment twice', async () => {
    const paymentId = objectId();
    const { service, paymentsRepository, financialTransactionsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: objectId(),
          amount: 100,
          status: PaymentStatus.Confirmed,
          isConfirmed: true,
        })),
      },
    });

    await expect(service.confirmPayment(paymentId, objectId())).rejects.toBeInstanceOf(ConflictException);
    expect(paymentsRepository.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(financialTransactionsRepository.create).not.toHaveBeenCalled();
  });

  it('cannot confirm a cancelled payment', async () => {
    const paymentId = objectId();
    const { service } = createService({
      paymentsRepository: {
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: objectId(),
          amount: 100,
          status: PaymentStatus.Cancelled,
          isConfirmed: false,
        })),
      },
    });

    await expect(service.confirmPayment(paymentId, objectId())).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents duplicate confirmation effects when ledger already exists', async () => {
    const paymentId = objectId();
    const { service, paymentsRepository, financialTransactionsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: objectId(),
          amount: 100,
          status: PaymentStatus.Pending,
          isConfirmed: false,
        })),
      },
      financialTransactionsRepository: {
        exists: jest.fn(() => chain({ _id: objectId() })),
      },
    });

    await expect(service.confirmPayment(paymentId, objectId())).rejects.toBeInstanceOf(ConflictException);
    expect(paymentsRepository.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(financialTransactionsRepository.create).not.toHaveBeenCalled();
  });

  it('creates a ledger entry on confirm', async () => {
    const paymentId = objectId();
    const studentId = objectId();
    const actorId = objectId();
    const pending = {
      _id: paymentId,
      student: studentId,
      amount: 120,
      status: PaymentStatus.Pending,
      isConfirmed: false,
    };
    const confirmed = {
      ...pending,
      status: PaymentStatus.Confirmed,
      isConfirmed: true,
      confirmedAt: new Date(),
    };
    const { service, financialTransactionsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn()
          .mockReturnValueOnce(chain(pending))
          .mockReturnValueOnce(chain(confirmed)),
        findByIdAndUpdate: jest.fn(() => chain(confirmed)),
      },
      financialTransactionsRepository: {
        exists: jest.fn(() => chain(null)),
        create: jest.fn(async value => value),
      },
    });

    await service.confirmPayment(paymentId, actorId);

    expect(financialTransactionsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: expect.any(Types.ObjectId),
      paymentId: expect.any(Types.ObjectId),
      amount: 120,
      type: FinancialTransactionType.PaymentConfirmed,
      actorId: expect.any(Types.ObjectId),
    }));
  });

  it('creates a ledger entry on cancel', async () => {
    const paymentId = objectId();
    const studentId = objectId();
    const pending = {
      _id: paymentId,
      student: studentId,
      amount: 90,
      status: PaymentStatus.Pending,
      isConfirmed: false,
    };
    const cancelled = {
      ...pending,
      status: PaymentStatus.Cancelled,
      cancelledAt: new Date(),
    };
    const { service, financialTransactionsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn()
          .mockReturnValueOnce(chain(pending))
          .mockReturnValueOnce(chain(cancelled)),
        findByIdAndUpdate: jest.fn(() => chain(cancelled)),
      },
      financialTransactionsRepository: {
        create: jest.fn(async value => value),
      },
    });

    await service.cancelPayment(paymentId, objectId());

    expect(financialTransactionsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 90,
      type: FinancialTransactionType.PaymentCancelled,
    }));
  });

  it('does not silently delete confirmed payments', async () => {
    const paymentId = objectId();
    const { service, paymentsRepository, financialTransactionsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: objectId(),
          amount: 100,
          status: PaymentStatus.Confirmed,
          isConfirmed: true,
        })),
      },
    });

    await expect(service.delete(paymentId, objectId())).rejects.toBeInstanceOf(BadRequestException);
    expect(paymentsRepository.findByIdAndDelete).not.toHaveBeenCalled();
    expect(financialTransactionsRepository.create).not.toHaveBeenCalled();
  });

  it('creates matching payment and ledger amounts on create', async () => {
    const studentId = objectId();
    const courseId = objectId();
    const paymentId = objectId();
    const { service, courseModel, userModel, paymentsRepository, financialTransactionsRepository } = createService({
      userModel: {
        findById: jest.fn(() => chain({ _id: studentId, role: Role.Student, branchIds: ['branch-a'] })),
      },
      courseModel: {
        findById: jest.fn(() => chain({ _id: courseId, price: 200, students: [studentId] })),
        find: jest.fn(() => ({ lean: jest.fn(async () => [{ _id: courseId }]) })),
      },
      paymentsRepository: {
        findOne: jest.fn(() => chain(null)),
        create: jest.fn(async value => ({ _id: paymentId, ...value })),
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: studentId,
          course: courseId,
          amount: 200,
          status: PaymentStatus.Pending,
        })),
      },
      financialTransactionsRepository: {
        create: jest.fn(async value => value),
      },
    });

    await service.create({ student: studentId, courseId }, objectId());

    expect(userModel.findById).toHaveBeenCalledWith(studentId);
    expect(courseModel.findById).toHaveBeenCalledWith(courseId);
    expect(paymentsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 200 }));
    expect(financialTransactionsRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 200,
      type: FinancialTransactionType.PaymentCreated,
    }));
  });

  it('actor cannot mutate payments outside branch scope', async () => {
    const paymentId = objectId();
    const { service, paymentsRepository } = createService({
      paymentsRepository: {
        findById: jest.fn(() => chain({
          _id: paymentId,
          student: {
            _id: objectId(),
            role: Role.Student,
            branchIds: ['branch-b'],
          },
          amount: 100,
          status: PaymentStatus.Pending,
        })),
      },
    });

    await expect(
      service.confirmPaymentForActor(paymentId, {
        userId: objectId(),
        role: Role.Admin,
        branchIds: ['branch-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(paymentsRepository.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
