import { Types } from 'mongoose';
import { AppConfigService } from '../config/app-config.service';
import { PaymentStatus } from '../payments/payment-status.enum';
import { DebtRemindersService } from './debt-reminders.service';
import { SmsTemplateService } from './sms/sms-template.service';

function objectId(): string {
  return new Types.ObjectId().toString();
}

function createPayment(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    courseId: new Types.ObjectId(),
    branchId: new Types.ObjectId(),
    groupId: new Types.ObjectId(),
    expectedAmount: 100,
    paidAmount: 0,
    remainingAmount: 100,
    overpaidAmount: 0,
    status: PaymentStatus.Debt,
    isFrozen: false,
    dueDate: new Date('2020-01-31T23:59:59.999Z'),
    year: 2020,
    month: 1,
    ...overrides,
  };
}

function createService() {
  const appConfig = {
    appName: 'Inter Talim',
    sms: {
      enabled: false,
      dryRun: true,
      provider: 'mock',
      defaultLocale: 'ru',
      centerName: 'Inter Talim',
      maxDebtRemindersPerDay: 3,
    },
  };
  const paymentsRepository = { find: jest.fn() };
  const deliveryRepository = {
    create: jest.fn(async (payload) => payload),
    count: jest.fn(async () => 0),
  };
  const smsService: {
    normalizePhone: jest.Mock;
    sendSms: jest.Mock;
  } = {
    normalizePhone: jest.fn((phone?: string) => phone?.replace(/\s/g, '')),
    sendSms: jest.fn(async () => ({
      success: true,
      status: 'dry_run',
      rawResponse: { dryRun: true },
    })),
  };
  const studentModel: { findById: jest.Mock } = {
    findById: jest.fn(() => ({
      lean: async () => ({
        _id: objectId(),
        firstName: 'Ali',
        lastName: 'Valiyev',
        phoneNumber: '+998 90 111 22 33',
        parentPhoneNumber: '+998 90 999 88 77',
      }),
    })),
  };
  const courseModel: { findById: jest.Mock } = {
    findById: jest.fn(() => ({
      lean: async () => ({ _id: objectId(), name: 'Math' }),
    })),
  };
  const branchModel: { findById: jest.Mock } = {
    findById: jest.fn(() => ({
      lean: async () => ({ _id: objectId(), name: 'Main branch' }),
    })),
  };

  return {
    service: new DebtRemindersService(
      appConfig as AppConfigService,
      paymentsRepository as never,
      deliveryRepository as never,
      smsService as never,
      new SmsTemplateService(),
      studentModel as never,
      courseModel as never,
      branchModel as never,
    ),
    appConfig,
    paymentsRepository,
    deliveryRepository,
    smsService,
    studentModel,
    courseModel,
    branchModel,
  };
}

describe('DebtRemindersService', () => {
  it('sends only eligible debt payments and records dry_run history', async () => {
    const { service, paymentsRepository, deliveryRepository, smsService } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);

    const result = await service.sendDebtReminders({ dryRun: true });

    expect(paymentsRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        remainingAmount: { $gt: 0 },
      }),
    );
    expect(result.eligiblePayments).toBe(1);
    expect(result.attempted).toBe(2);
    expect(result.dryRun).toBe(2);
    expect(smsService.sendSms).toHaveBeenCalledTimes(2);
    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dry_run', recipientType: 'student' }),
    );
  });

  it('skips safely when no phone exists', async () => {
    const { service, paymentsRepository, studentModel, deliveryRepository } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);
    studentModel.findById.mockReturnValue({
      lean: async () => ({ firstName: 'Ali', lastName: 'Valiyev' }),
    });

    const result = await service.sendDebtReminders({ dryRun: true });

    expect(result.skipped).toBe(1);
    expect(result.skippedReasons.missingPhone).toBe(1);
    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' }),
    );
  });

  it('enforces max 3 reminders per day per payment and phone', async () => {
    const { service, paymentsRepository, deliveryRepository, smsService } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);
    deliveryRepository.count.mockResolvedValue(3);

    const result = await service.sendDebtReminders({ dryRun: true });

    expect(result.skippedReasons.dailyLimit).toBe(2);
    expect(smsService.sendSms).not.toHaveBeenCalled();
  });

  it('records sent and failed statuses', async () => {
    const { service, paymentsRepository, smsService, deliveryRepository } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);
    smsService.sendSms
      .mockResolvedValueOnce({
        success: true,
        status: 'sent',
        providerMessageId: 'sent-id',
      })
      .mockResolvedValueOnce({
        success: false,
        status: 'failed',
        error: 'provider failed',
      });

    const result = await service.sendDebtReminders({ dryRun: false });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', providerMessageId: 'sent-id' }),
    );
    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'provider failed' }),
    );
  });

  it('provider failure does not stop the batch', async () => {
    const { service, paymentsRepository, smsService } = createService();
    paymentsRepository.find.mockResolvedValue([
      createPayment(),
      createPayment(),
    ]);
    smsService.sendSms
      .mockRejectedValueOnce(new Error('provider down'))
      .mockResolvedValue({
        success: true,
        status: 'dry_run',
      });

    const result = await service.sendDebtReminders({ dryRun: true });

    expect(result.failed).toBe(1);
    expect(result.paymentIdsProcessed).toHaveLength(2);
  });

  it('uses localized template and records the localized message', async () => {
    const { service, paymentsRepository, studentModel, deliveryRepository } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);
    studentModel.findById.mockReturnValue({
      lean: async () => ({
        firstName: 'Ali',
        lastName: 'Valiyev',
        preferredLocale: 'uz',
        phoneNumber: '+99890',
      }),
    });

    await service.sendDebtReminders({ dryRun: true });

    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Assalomu alaykum'),
      }),
    );
    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Inter Talim'),
      }),
    );
  });

  it('uses default locale when student locale is absent', async () => {
    const { service, paymentsRepository, deliveryRepository } = createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);

    await service.sendDebtReminders({ dryRun: true });

    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Здравствуйте'),
      }),
    );
  });

  it('uses branch locale when student locale is absent and branch locale exists', async () => {
    const { service, paymentsRepository, branchModel, deliveryRepository } =
      createService();
    paymentsRepository.find.mockResolvedValue([createPayment()]);
    branchModel.findById.mockReturnValue({
      lean: async () => ({ name: 'Main branch', locale: 'en' }),
    });

    await service.sendDebtReminders({ dryRun: true });

    expect(deliveryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Hello'),
      }),
    );
  });
});
