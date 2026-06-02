import { Injectable } from '@nestjs/common';

export const SMS_LOCALES = ['ru', 'uz', 'en'] as const;
export type SmsLocale = (typeof SMS_LOCALES)[number];

export interface DebtReminderTemplateInput {
  locale?: string;
  studentName?: string;
  courseName?: string;
  amountDue: number;
  year: number;
  month: number;
  centerName?: string;
  dueDate?: Date | string;
}

const DEFAULT_LOCALE: SmsLocale = 'ru';
const DEFAULT_STUDENT_NAME = {
  ru: 'студента',
  uz: 'talaba',
  en: 'student',
} satisfies Record<SmsLocale, string>;
const DEFAULT_COURSE_NAME = {
  ru: 'курс',
  uz: 'kurs',
  en: 'course',
} satisfies Record<SmsLocale, string>;
const DEFAULT_CENTER_NAME = 'Inter Talim';
const SMS_SOFT_LIMIT = 160;

@Injectable()
export class SmsTemplateService {
  buildDebtReminder(input: DebtReminderTemplateInput): string {
    const locale = this.resolveLocale(input.locale);
    const values = this.normalizeValues(input, locale);
    const message = this.renderDebtReminder(locale, values);

    if (message.length <= SMS_SOFT_LIMIT) {
      return message;
    }

    return this.renderCompactDebtReminder(locale, {
      ...values,
      studentName: this.compact(values.studentName, 24),
      courseName: this.compact(values.courseName, 24),
      centerName: this.compact(values.centerName, 24),
    });
  }

  resolveLocale(locale?: string): SmsLocale {
    const normalized = locale?.trim().toLowerCase();
    return SMS_LOCALES.includes(normalized as SmsLocale)
      ? (normalized as SmsLocale)
      : DEFAULT_LOCALE;
  }

  private normalizeValues(input: DebtReminderTemplateInput, locale: SmsLocale) {
    return {
      studentName:
        this.clean(input.studentName) ?? DEFAULT_STUDENT_NAME[locale],
      courseName: this.clean(input.courseName) ?? DEFAULT_COURSE_NAME[locale],
      amountDue: this.formatAmount(input.amountDue),
      year: input.year,
      month: input.month,
      centerName: this.clean(input.centerName) ?? DEFAULT_CENTER_NAME,
    };
  }

  private renderDebtReminder(
    locale: SmsLocale,
    values: ReturnType<SmsTemplateService['normalizeValues']>,
  ): string {
    if (locale === 'uz') {
      return `Assalomu alaykum! Eslatma: ${values.studentName} uchun ${values.courseName} kursi bo'yicha ${values.month}/${values.year} davrida ${values.amountDue} qarzdorlik bor. ${values.centerName}`;
    }

    if (locale === 'en') {
      return `Hello! Reminder: ${values.studentName} has an outstanding balance of ${values.amountDue} for ${values.courseName} for ${values.month}/${values.year}. ${values.centerName}`;
    }

    return `Здравствуйте! Напоминание: у ${values.studentName} задолженность ${values.amountDue} за курс ${values.courseName} за ${values.month}/${values.year}. ${values.centerName}`;
  }

  private renderCompactDebtReminder(
    locale: SmsLocale,
    values: ReturnType<SmsTemplateService['normalizeValues']>,
  ): string {
    const templates: Record<SmsLocale, string> = {
      ru: `Напоминание: ${values.studentName}, долг ${values.amountDue}, ${values.courseName}, ${values.month}/${values.year}. ${values.centerName}`,
      uz: `Eslatma: ${values.studentName}, qarz ${values.amountDue}, ${values.courseName}, ${values.month}/${values.year}. ${values.centerName}`,
      en: `Reminder: ${values.studentName}, balance ${values.amountDue}, ${values.courseName}, ${values.month}/${values.year}. ${values.centerName}`,
    };
    const compactMessage = templates[locale];

    if (compactMessage.length <= SMS_SOFT_LIMIT) {
      return compactMessage;
    }

    return templates[locale].slice(0, SMS_SOFT_LIMIT).trimEnd();
  }

  private clean(value?: string): string | undefined {
    const cleaned = value?.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned : undefined;
  }

  private compact(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return value.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  }

  private formatAmount(value: number): string {
    return Number.isFinite(value) ? String(value) : '0';
  }
}
