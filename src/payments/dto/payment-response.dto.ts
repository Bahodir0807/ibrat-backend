import { PaymentStatus } from '../payment-status.enum';

export interface PaymentHistoryDto {
  amount: number;
  paidAt: Date;
  paymentMethod: 'cash' | 'card' | 'transfer';
  comment?: string;
  createdBy: string;
}

export interface PaymentResponseDto {
  id: string;
  studentId: string;
  courseId: string;
  groupId: string;
  branchId: string;
  month: number;
  year: number;
  paymentPeriod: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  status: PaymentStatus;
  isFrozen: boolean;
  freezeReason?: string;
  freezeFrom?: Date;
  freezeTo?: Date;
  comment?: string;
  paymentHistory: PaymentHistoryDto[];
  createdAt: Date;
  updatedAt: Date;
}

export function mapPaymentResponse(value: any): PaymentResponseDto | null {
  if (!value) return null;
  
  return {
    id: value._id?.toString() || value.id,
    studentId: value.studentId?.toString() || value.studentId,
    courseId: value.courseId?.toString() || value.courseId,
    groupId: value.groupId?.toString() || value.groupId,
    branchId: value.branchId?.toString() || value.branchId,
    month: value.month,
    year: value.year,
    paymentPeriod: value.paymentPeriod,
    expectedAmount: value.expectedAmount,
    paidAmount: value.paidAmount,
    remainingAmount: value.remainingAmount,
    overpaidAmount: value.overpaidAmount,
    status: value.status,
    isFrozen: value.isFrozen,
    freezeReason: value.freezeReason,
    freezeFrom: value.freezeFrom,
    freezeTo: value.freezeTo,
    comment: value.comment,
    paymentHistory: (value.paymentHistory || []).map((h: any) => ({
      amount: h.amount,
      paidAt: h.paidAt,
      paymentMethod: h.paymentMethod,
      comment: h.comment,
      createdBy: h.createdBy?.toString() || h.createdBy,
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function mapPaymentResponses(values: any[]): PaymentResponseDto[] {
  return values.map(value => mapPaymentResponse(value)).filter((v): v is PaymentResponseDto => v !== null);
}
