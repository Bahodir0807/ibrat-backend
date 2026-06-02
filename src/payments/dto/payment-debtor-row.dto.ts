export interface PaymentDebtorRowDto {
  paymentId: string;
  studentId: string;
  studentNumber?: string;
  studentName: string;
  phone?: string;
  parentPhone?: string;
  courseId: string;
  courseName?: string;
  groupId: string;
  groupName?: string;
  branchId: string;
  // Branch entity is not currently joined in payments reports, so value is nullable.
  branchName: string | null;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'debt' | 'frozen' | 'overpaid';
  dueDate?: string;
  year: number;
  month: number;
}
