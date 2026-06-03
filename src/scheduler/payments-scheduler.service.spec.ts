jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

import { PaymentsSchedulerService } from './payments-scheduler.service';
import { Test } from '@nestjs/testing';

function createService(overrides: Record<string, unknown> = {}) {
  const scheduler = {
    enabled: false,
    dryRun: true,
    paymentGenerationEnabled: false,
    debtAgingEnabled: false,
    paymentGenerationHour: 1,
    debtAgingHour: 2,
    debtRemindersHour: 10,
    ...overrides,
  };
  const appConfig = { scheduler };
  const paymentsService = {
    generateMonthlyPayments: jest.fn(async (options) => ({
      year: options.year,
      month: options.month,
      dryRun: options.dryRun,
      filters: {},
      scannedStudents: 1,
      scannedPairs: 1,
      created: 0,
      skippedExisting: 1,
      skippedRaceDuplicate: 0,
      skippedInactive: 0,
      skippedMissingGroup: 0,
      skippedMissingBranch: 0,
      skippedPricingError: 0,
      createdPaymentIds: [],
      skipped: [{ studentId: 'student-id', reason: 'existing' }],
    })),
    recalculateDebtAging: jest.fn(async (options) => ({
      dryRun: options.dryRun,
      scanned: 1,
      changed: 0,
      skippedFrozen: 0,
      skippedPaid: 1,
      skippedOverpaid: 0,
      failures: [],
    })),
  };
  const debtRemindersService = {
    sendDebtReminders: jest.fn(async (options) => ({
      eligiblePayments: 1,
      attempted: 1,
      sent: 0,
      dryRun: options.dryRun ? 1 : 0,
      skipped: 0,
      failed: 0,
      skippedReasons: {},
      paymentIdsProcessed: ['payment-id'],
    })),
  };
  const cronJobs: Array<{ stop: () => void }> = [];
  const schedulerRegistry = {
    addCronJob: jest.fn((_: string, job: { stop: () => void }) => {
      cronJobs.push(job);
    }),
  };

  return {
    service: new PaymentsSchedulerService(
      appConfig as any,
      paymentsService as any,
      debtRemindersService as any,
      schedulerRegistry as any,
    ),
    paymentsService,
    debtRemindersService,
    schedulerRegistry,
    cronJobs,
  };
}

describe('PaymentsSchedulerService', () => {
  it('does not register jobs when scheduler is disabled', () => {
    const { service, schedulerRegistry } = createService({ enabled: false });

    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
  });

  it('compiles in a testing module and does not register jobs when disabled', async () => {
    const appConfig = {
      scheduler: {
        enabled: false,
        dryRun: true,
        paymentGenerationEnabled: false,
        debtAgingEnabled: false,
        debtRemindersEnabled: false,
        paymentGenerationHour: 1,
        debtAgingHour: 2,
        debtRemindersHour: 10,
      },
      sms: { dryRun: true },
    };
    const schedulerRegistry = { addCronJob: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsSchedulerService,
        { provide: 'AppConfigService', useValue: appConfig },
      ],
    })
      .overrideProvider(PaymentsSchedulerService)
      .useFactory({
        factory: () =>
          new PaymentsSchedulerService(
            appConfig as any,
            {
              generateMonthlyPayments: jest.fn(),
              recalculateDebtAging: jest.fn(),
            } as any,
            { sendDebtReminders: jest.fn() } as any,
            schedulerRegistry as any,
          ),
      })
      .compile();
    const service = moduleRef.get(PaymentsSchedulerService);

    service.onModuleInit();

    expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    await moduleRef.close();
  });

  it('registers scheduler jobs when enabled', () => {
    const { service, schedulerRegistry, cronJobs } = createService({
      enabled: true,
    });

    service.onModuleInit();
    cronJobs.forEach((job) => job.stop());

    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(3);
  });

  it('manual monthly generation supports dry-run', async () => {
    const { service, paymentsService } = createService({ dryRun: true });

    const result = await service.runMonthlyGenerationNow();

    expect(result.dryRun).toBe(true);
    expect(paymentsService.generateMonthlyPayments).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('manual debt recalculation supports dry-run', async () => {
    const { service, paymentsService } = createService({ dryRun: true });

    const result = await service.runDebtRecalculationNow();

    expect(result.dryRun).toBe(true);
    expect(paymentsService.recalculateDebtAging).toHaveBeenCalledWith({
      dryRun: true,
    });
  });

  it('skips scheduled monthly generation when job flag is disabled', async () => {
    const { service, paymentsService } = createService({
      enabled: true,
      paymentGenerationEnabled: false,
    });

    await (service as any).handleMonthlyGenerationSchedule();

    expect(paymentsService.generateMonthlyPayments).not.toHaveBeenCalled();
  });

  it('manual debt reminders supports dry-run', async () => {
    const { service, debtRemindersService } = createService({ dryRun: true });

    const result = await service.runDebtRemindersNow();

    expect(result.dryRun).toBe(true);
    expect(debtRemindersService.sendDebtReminders).toHaveBeenCalledWith({
      dryRun: true,
    });
  });

  it('skips scheduled debt reminders when job flag is disabled', async () => {
    const { service, debtRemindersService } = createService({
      enabled: true,
      debtRemindersEnabled: false,
    });

    await (service as any).handleDebtRemindersSchedule();

    expect(debtRemindersService.sendDebtReminders).not.toHaveBeenCalled();
  });
});
