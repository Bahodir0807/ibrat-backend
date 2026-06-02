import { PaymentStatus } from './payment-status.enum';

export interface PaymentLifecycleInput {
  expectedAmount: number;
  paidAmount: number;
  dueDate?: Date;
  year?: number;
  month?: number;
  isFrozen?: boolean;
}

export interface PaymentLifecycleResult {
  dueDate?: Date;
  remainingAmount: number;
  overpaidAmount: number;
  status: PaymentStatus;
}

export function getPaymentDefaultDueDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export function calculatePaymentLifecycle(
  input: PaymentLifecycleInput,
  now: Date = new Date(),
): PaymentLifecycleResult {
  const remainingAmount = Math.max(0, input.expectedAmount - input.paidAmount);
  const overpaidAmount = Math.max(0, input.paidAmount - input.expectedAmount);
  const fallbackDueDate =
    input.year && input.month
      ? getPaymentDefaultDueDate(input.year, input.month)
      : undefined;
  const resolvedDueDate = input.dueDate ?? fallbackDueDate;

  if (input.isFrozen) {
    return {
      dueDate: resolvedDueDate,
      remainingAmount,
      overpaidAmount,
      status: PaymentStatus.Frozen,
    };
  }

  if (overpaidAmount > 0) {
    return {
      dueDate: resolvedDueDate,
      remainingAmount,
      overpaidAmount,
      status: PaymentStatus.Overpaid,
    };
  }

  if (input.paidAmount >= input.expectedAmount) {
    return {
      dueDate: resolvedDueDate,
      remainingAmount,
      overpaidAmount,
      status: PaymentStatus.Paid,
    };
  }

  if (
    remainingAmount > 0 &&
    resolvedDueDate &&
    resolvedDueDate.getTime() < now.getTime()
  ) {
    return {
      dueDate: resolvedDueDate,
      remainingAmount,
      overpaidAmount,
      status: PaymentStatus.Debt,
    };
  }

  if (input.paidAmount > 0) {
    return {
      dueDate: resolvedDueDate,
      remainingAmount,
      overpaidAmount,
      status: PaymentStatus.Partial,
    };
  }

  return {
    dueDate: resolvedDueDate,
    remainingAmount,
    overpaidAmount,
    status: PaymentStatus.Pending,
  };
}
