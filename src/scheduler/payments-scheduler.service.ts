import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfigService } from '../config/app-config.service';
import {
  GenerateMonthlyPaymentsResult,
  PaymentsService,
  RecalculateDebtAgingResult,
} from '../payments/payments.service';
import {
  DebtReminderSummary,
  DebtRemindersService,
} from '../notifications/debt-reminders.service';

export interface SchedulerRunResult<T> {
  job: 'monthlyPaymentGeneration' | 'debtAgingRecalculation' | 'debtReminders';
  dryRun: boolean;
  durationMs: number;
  result: T;
}

@Injectable()
export class PaymentsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsSchedulerService.name);
  private monthlyGenerationRunning = false;
  private debtAgingRunning = false;
  private debtRemindersRunning = false;

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly debtRemindersService: DebtRemindersService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const config = this.appConfig.scheduler;
    if (!config.enabled) {
      this.logger.log(
        JSON.stringify({ event: 'scheduler.disabled', scheduler: 'payments' }),
      );
      return;
    }

    this.registerJob(
      'payments.monthly-generation',
      config.paymentGenerationHour,
      () => void this.handleMonthlyGenerationSchedule(),
    );
    this.registerJob(
      'payments.debt-aging',
      config.debtAgingHour,
      () => void this.handleDebtAgingSchedule(),
    );
    this.registerJob(
      'payments.debt-reminders',
      config.debtRemindersHour,
      () => void this.handleDebtRemindersSchedule(),
    );
  }

  async runMonthlyGenerationNow(
    options: { dryRun?: boolean } = {},
  ): Promise<SchedulerRunResult<GenerateMonthlyPaymentsResult>> {
    const startedAt = Date.now();
    const now = new Date();
    const dryRun = options.dryRun ?? this.appConfig.scheduler.dryRun;
    const result = await this.paymentsService.generateMonthlyPayments({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      dryRun,
    });

    return {
      job: 'monthlyPaymentGeneration',
      dryRun,
      durationMs: Date.now() - startedAt,
      result,
    };
  }

  async runDebtRecalculationNow(
    options: { dryRun?: boolean } = {},
  ): Promise<SchedulerRunResult<RecalculateDebtAgingResult>> {
    const startedAt = Date.now();
    const dryRun = options.dryRun ?? this.appConfig.scheduler.dryRun;
    const result = await this.paymentsService.recalculateDebtAging({ dryRun });

    return {
      job: 'debtAgingRecalculation',
      dryRun,
      durationMs: Date.now() - startedAt,
      result,
    };
  }

  async runDebtRemindersNow(
    options: { dryRun?: boolean } = {},
  ): Promise<SchedulerRunResult<DebtReminderSummary>> {
    const startedAt = Date.now();
    const dryRun =
      options.dryRun ??
      this.appConfig.scheduler.dryRun ??
      this.appConfig.sms.dryRun;
    const result = await this.debtRemindersService.sendDebtReminders({
      dryRun,
    });

    return {
      job: 'debtReminders',
      dryRun,
      durationMs: Date.now() - startedAt,
      result,
    };
  }

  private registerJob(name: string, hour: number, handler: () => void): void {
    const job = new CronJob(`0 ${hour} * * *`, handler);
    this.schedulerRegistry.addCronJob(name, job);
    job.start();
    this.logger.log(
      JSON.stringify({ event: 'scheduler.job.registered', name, hour }),
    );
  }

  private async handleMonthlyGenerationSchedule(): Promise<void> {
    const config = this.appConfig.scheduler;
    if (!config.paymentGenerationEnabled) {
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'monthlyPaymentGeneration',
          reason: 'disabled',
        }),
      );
      return;
    }
    if (this.monthlyGenerationRunning) {
      this.logger.warn(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'monthlyPaymentGeneration',
          reason: 'alreadyRunning',
        }),
      );
      return;
    }

    this.monthlyGenerationRunning = true;
    this.logger.log(
      JSON.stringify({
        event: 'scheduler.job.started',
        job: 'monthlyPaymentGeneration',
        dryRun: config.dryRun,
      }),
    );
    try {
      const summary = await this.runMonthlyGenerationNow({
        dryRun: config.dryRun,
      });
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.completed',
          job: summary.job,
          durationMs: summary.durationMs,
          dryRun: summary.dryRun,
          created: summary.result.created,
          skipped:
            summary.result.skippedExisting +
            summary.result.skippedRaceDuplicate +
            summary.result.skippedInactive +
            summary.result.skippedMissingGroup +
            summary.result.skippedMissingBranch +
            summary.result.skippedPricingError,
          duplicateRace: summary.result.skippedRaceDuplicate,
          filters: summary.result.filters,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'scheduler.job.failed',
          job: 'monthlyPaymentGeneration',
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      this.monthlyGenerationRunning = false;
    }
  }

  private async handleDebtAgingSchedule(): Promise<void> {
    const config = this.appConfig.scheduler;
    if (!config.debtAgingEnabled) {
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'debtAgingRecalculation',
          reason: 'disabled',
        }),
      );
      return;
    }
    if (this.debtAgingRunning) {
      this.logger.warn(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'debtAgingRecalculation',
          reason: 'alreadyRunning',
        }),
      );
      return;
    }

    this.debtAgingRunning = true;
    this.logger.log(
      JSON.stringify({
        event: 'scheduler.job.started',
        job: 'debtAgingRecalculation',
        dryRun: config.dryRun,
      }),
    );
    try {
      const summary = await this.runDebtRecalculationNow({
        dryRun: config.dryRun,
      });
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.completed',
          job: summary.job,
          durationMs: summary.durationMs,
          dryRun: summary.dryRun,
          changed: summary.result.changed,
          skippedFrozen: summary.result.skippedFrozen,
          failures: summary.result.failures.length,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'scheduler.job.failed',
          job: 'debtAgingRecalculation',
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      this.debtAgingRunning = false;
    }
  }

  private async handleDebtRemindersSchedule(): Promise<void> {
    const config = this.appConfig.scheduler;
    if (!config.debtRemindersEnabled) {
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'debtReminders',
          reason: 'disabled',
        }),
      );
      return;
    }
    if (this.debtRemindersRunning) {
      this.logger.warn(
        JSON.stringify({
          event: 'scheduler.job.skipped',
          job: 'debtReminders',
          reason: 'alreadyRunning',
        }),
      );
      return;
    }

    this.debtRemindersRunning = true;
    this.logger.log(
      JSON.stringify({
        event: 'scheduler.job.started',
        job: 'debtReminders',
        dryRun: config.dryRun || this.appConfig.sms.dryRun,
      }),
    );
    try {
      const summary = await this.runDebtRemindersNow({
        dryRun: config.dryRun || this.appConfig.sms.dryRun,
      });
      this.logger.log(
        JSON.stringify({
          event: 'scheduler.job.completed',
          job: summary.job,
          durationMs: summary.durationMs,
          dryRun: summary.dryRun,
          eligiblePayments: summary.result.eligiblePayments,
          attempted: summary.result.attempted,
          sent: summary.result.sent,
          dryRunCount: summary.result.dryRun,
          skipped: summary.result.skipped,
          failed: summary.result.failed,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'scheduler.job.failed',
          job: 'debtReminders',
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      this.debtRemindersRunning = false;
    }
  }
}
