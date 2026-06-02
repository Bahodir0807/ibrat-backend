import { PaymentStatus } from './payment-status.enum';
import { calculatePaymentLifecycle } from './payment-lifecycle.util';

describe('payment-lifecycle.util', () => {
  it('legacy payment without dueDate becomes debt if period is old', () => {
    const result = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 20,
        year: 2020,
        month: 1,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(result.status).toBe(PaymentStatus.Debt);
    expect(result.dueDate?.toISOString()).toBe('2020-01-31T23:59:59.999Z');
  });

  it('legacy payment without dueDate stays pending when period is not overdue', () => {
    const result = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 0,
        year: 2100,
        month: 1,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(result.status).toBe(PaymentStatus.Pending);
  });

  it('legacy payment without dueDate stays partial when period is not overdue', () => {
    const result = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 20,
        year: 2100,
        month: 1,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(result.status).toBe(PaymentStatus.Partial);
  });

  it('frozen legacy payment stays frozen', () => {
    const result = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 0,
        year: 2020,
        month: 1,
        isFrozen: true,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(result.status).toBe(PaymentStatus.Frozen);
  });

  it('calculation is idempotent', () => {
    const first = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 20,
        year: 2020,
        month: 1,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    const second = calculatePaymentLifecycle(
      {
        expectedAmount: 100,
        paidAmount: 20,
        dueDate: first.dueDate,
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(second).toEqual(first);
  });
});
