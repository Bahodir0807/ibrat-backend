export interface PaymentsReportsSummaryResponseDto {
  totalExpectedAmount: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
  totalOverpaidAmount: number;
  totalDebtAmount: number;
  totalPaymentsCount: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  debtCount: number;
  frozenCount: number;
  overpaidCount: number;
}
