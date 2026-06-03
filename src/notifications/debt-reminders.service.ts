import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfigService } from '../config/app-config.service';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { PaymentsRepository } from '../payments/payments.repository';
import { PaymentStatus } from '../payments/payment-status.enum';
import { PaymentDocument } from '../payments/schemas/payment.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { SmsService } from './sms/sms.service';
import { SmsTemplateService } from './sms/sms-template.service';

export interface SendDebtRemindersOptions {
  dryRun?: boolean;
  branchId?: string;
  courseId?: string;
  paymentId?: string;
}

export interface DebtReminderSummary {
  eligiblePayments: number;
  attempted: number;
  sent: number;
  dryRun: number;
  skipped: number;
  failed: number;
  skippedReasons: Record<string, number>;
  paymentIdsProcessed: string[];
}

type Recipient = {
  recipientType: 'student' | 'parent';
  phone?: string;
};

@Injectable()
export class DebtRemindersService {
  private readonly logger = new Logger(DebtRemindersService.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly deliveryRepository: NotificationDeliveryRepository,
    private readonly smsService: SmsService,
    private readonly smsTemplateService: SmsTemplateService,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async sendDebtReminders(
    options: SendDebtRemindersOptions = {},
  ): Promise<DebtReminderSummary> {
    const dryRun = options.dryRun ?? this.appConfig.sms.dryRun;
    const dateKey = this.getDateKey();
    const payments = await this.paymentsRepository.find(
      this.buildEligiblePaymentFilter(options),
    );
    const summary: DebtReminderSummary = {
      eligiblePayments: payments.length,
      attempted: 0,
      sent: 0,
      dryRun: 0,
      skipped: 0,
      failed: 0,
      skippedReasons: {},
      paymentIdsProcessed: [],
    };

    // Кэш для минимизации запросов к БД внутри цикла (решение проблемы N+1)
    const branchCache = new Map<string, Branch>();
    const courseCache = new Map<string, Course>();

    for (const payment of payments) {
      const paymentId = String(payment._id);
      summary.paymentIdsProcessed.push(paymentId);
      try {
        const student = await this.studentModel
          .findById(payment.studentId)
          .lean();

        const branchId = String(payment.branchId);
        const courseId = String(payment.courseId);

        if (!branchCache.has(branchId)) {
          const b = await this.branchModel.findById(branchId).lean();
          if (b) branchCache.set(branchId, b);
        }
        if (!courseCache.has(courseId)) {
          const c = await this.courseModel.findById(courseId).lean();
          if (c) courseCache.set(courseId, c);
        }

        const branch = branchCache.get(branchId) || null;
        const course = courseCache.get(courseId) || null;

        if (!student) {
          await this.recordSkipped(payment, dateKey, 'student', '', '', {
            reason: 'studentMissing',
          });
          this.incrementSkipped(summary, 'studentMissing');
          continue;
        }

        const message = this.buildDebtMessage(payment, student, course, branch);
        const recipients = this.collectRecipients(student);
        if (recipients.length === 0) {
          await this.recordSkipped(payment, dateKey, 'student', '', message, {
            reason: 'missingPhone',
          });
          this.incrementSkipped(summary, 'missingPhone');
          continue;
        }

        for (const recipient of recipients) {
          await this.processRecipient(
            payment,
            recipient,
            message,
            dateKey,
            dryRun,
            summary,
          );
        }
      } catch (error) {
        summary.failed += 1;
        this.logger.error(
          JSON.stringify({
            event: 'debt_reminder.payment.failed',
            paymentId,
            reason: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    return summary;
  }

  private async processRecipient(
    payment: PaymentDocument,
    recipient: Recipient,
    message: string,
    dateKey: string,
    dryRun: boolean,
    summary: DebtReminderSummary,
  ): Promise<void> {
    const phone = this.smsService.normalizePhone(recipient.phone);
    if (!phone) {
      await this.recordSkipped(
        payment,
        dateKey,
        recipient.recipientType,
        '',
        message,
        { reason: 'missingPhone' },
      );
      this.incrementSkipped(summary, 'missingPhone');
      return;
    }

    const attempts = await this.deliveryRepository.count({
      paymentId: payment._id,
      phone,
      dateKey,
      status: { $in: ['sent', 'dry_run', 'failed', 'pending'] },
    });
    if (attempts >= this.appConfig.sms.maxDebtRemindersPerDay) {
      await this.recordSkipped(
        payment,
        dateKey,
        recipient.recipientType,
        phone,
        message,
        { reason: 'dailyLimit' },
      );
      this.incrementSkipped(summary, 'dailyLimit');
      return;
    }

    summary.attempted += 1;
    const smsResult = await this.smsService.sendSms(phone, message, {
      dryRun,
      metadata: this.buildMetadata(payment),
    });
    await this.deliveryRepository.create({
      type: 'debt_sms',
      channel: 'sms',
      paymentId: payment._id,
      studentId: payment.studentId,
      recipientType: recipient.recipientType,
      phone,
      message,
      status: smsResult.status,
      providerMessageId: smsResult.providerMessageId,
      providerResponse: smsResult.rawResponse,
      error: smsResult.error,
      sentAt: smsResult.status === 'sent' ? new Date() : undefined,
      dateKey,
      metadata: this.buildMetadata(payment),
    });

    if (smsResult.status === 'sent') {
      summary.sent += 1;
    } else if (smsResult.status === 'dry_run') {
      summary.dryRun += 1;
    } else if (smsResult.status === 'failed') {
      summary.failed += 1;
    } else {
      this.incrementSkipped(summary, smsResult.error ?? 'skipped');
    }
  }

  private buildEligiblePaymentFilter(options: SendDebtRemindersOptions) {
    const filter: Record<string, unknown> = {
      status: {
        $nin: [
          PaymentStatus.Paid,
          PaymentStatus.Frozen,
          PaymentStatus.Overpaid,
        ],
      },
      isFrozen: { $ne: true },
      remainingAmount: { $gt: 0 },
      $or: [{ status: PaymentStatus.Debt }, { dueDate: { $lt: new Date() } }],
    };
    if (options.branchId) {
      filter.branchId = new Types.ObjectId(options.branchId);
    }
    if (options.courseId) {
      filter.courseId = new Types.ObjectId(options.courseId);
    }
    if (options.paymentId) {
      filter._id = new Types.ObjectId(options.paymentId);
    }
    return filter;
  }

  private collectRecipients(student: Partial<Student>): Recipient[] {
    const recipients: Recipient[] = [];
    if (student.phoneNumber) {
      recipients.push({ recipientType: 'student', phone: student.phoneNumber });
    }
    if (student.parentPhoneNumber) {
      recipients.push({
        recipientType: 'parent',
        phone: student.parentPhoneNumber,
      });
    }
    return recipients;
  }

  private buildDebtMessage(
    payment: PaymentDocument,
    student: Partial<Student>,
    course: Partial<Course> | null,
    branch: Partial<Branch> | null,
  ): string {
    const studentName =
      [student.firstName, student.lastName].filter(Boolean).join(' ').trim() ||
      undefined;

    return this.smsTemplateService.buildDebtReminder({
      locale: this.resolveLocale(student, branch),
      studentName,
      courseName: course?.name,
      amountDue: payment.remainingAmount,
      year: payment.year,
      month: payment.month,
      centerName: this.appConfig.sms.centerName,
      dueDate: payment.dueDate,
    });
  }

  private resolveLocale(
    student: Partial<Student>,
    branch: Partial<Branch> | null,
  ): string {
    const preferredLocale = (student as { preferredLocale?: string })
      .preferredLocale;
    const branchLocale = (branch as { locale?: string } | null)?.locale;
    return (
      preferredLocale ??
      branchLocale ??
      this.appConfig.sms.defaultLocale ??
      'ru'
    );
  }

  private async recordSkipped(
    payment: PaymentDocument,
    dateKey: string,
    recipientType: 'student' | 'parent',
    phone: string,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    await this.deliveryRepository.create({
      type: 'debt_sms',
      channel: 'sms',
      paymentId: payment._id,
      studentId: payment.studentId,
      recipientType,
      phone,
      message,
      status: 'skipped',
      dateKey,
      metadata: { ...this.buildMetadata(payment), ...metadata },
    });
  }

  private buildMetadata(payment: PaymentDocument) {
    return {
      courseId: String(payment.courseId),
      branchId: String(payment.branchId),
      amountDue: payment.remainingAmount,
      year: payment.year,
      month: payment.month,
    };
  }

  private getDateKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  private incrementSkipped(summary: DebtReminderSummary, reason: string): void {
    summary.skipped += 1;
    summary.skippedReasons[reason] = (summary.skippedReasons[reason] ?? 0) + 1;
  }
}
