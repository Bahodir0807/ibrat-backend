import { SmsTemplateService } from './sms-template.service';

describe('SmsTemplateService', () => {
  const service = new SmsTemplateService();
  const baseInput = {
    studentName: 'Ali Valiyev',
    courseName: 'Math',
    amountDue: 120000,
    year: 2026,
    month: 3,
    centerName: 'Inter Talim',
  };

  it('renders RU debt reminder template', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'ru',
    });

    expect(message).toContain('Здравствуйте');
    expect(message).toContain('Ali Valiyev');
    expect(message).toContain('120000');
    expect(message).toContain('Math');
    expect(message).toContain('3/2026');
    expect(message).toContain('Inter Talim');
  });

  it('renders UZ debt reminder template', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'uz',
    });

    expect(message).toContain('Assalomu alaykum');
    expect(message).toContain('qarzdorlik');
  });

  it('renders EN debt reminder template', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'en',
    });

    expect(message).toContain('Hello');
    expect(message).toContain('outstanding balance');
  });

  it('falls back to RU for unsupported locale', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'de',
    });

    expect(message).toContain('Здравствуйте');
  });

  it('uses safe course fallback when courseName is missing', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'en',
      courseName: undefined,
    });

    expect(message).toContain('course');
  });

  it('does not include internal ids', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'en',
    });

    expect(message).not.toContain('507f1f77bcf86cd799439011');
    expect(message).not.toContain('paymentId');
    expect(message).not.toContain('studentId');
    expect(message).not.toContain('_id');
  });

  it('keeps long messages under the simple SMS length guard', () => {
    const message = service.buildDebtReminder({
      ...baseInput,
      locale: 'en',
      studentName: 'Very Long Student Name '.repeat(8),
      courseName: 'Very Long Course Name '.repeat(8),
      centerName: 'Very Long Center Name '.repeat(8),
    });

    expect(message.length).toBeLessThanOrEqual(160);
    expect(message).toContain('120000');
  });
});
