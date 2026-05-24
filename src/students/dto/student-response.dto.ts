import { StudentStatus } from '../student-status.enum';

type PlainObject = Record<string, unknown>;

export type StudentResponseDto = {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  telegramId?: string;
  parentPhoneNumber?: string;
  parentName?: string;
  groupIds: string[];
  courseIds: string[];
  branchIds: string[];
  monthlyPayment?: number;
  paymentDueDate?: Date;
  comment?: string;
  isActive: boolean;
  status: StudentStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item));
  }
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toHexString?: () => string }).toHexString === 'function'
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return value;
  }
  if (typeof (value as { toObject?: () => unknown }).toObject === 'function') {
    return toPlain((value as { toObject: () => unknown }).toObject());
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, toPlain(nested)]),
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => item != null).map((item) => String(item))
    : [];
}

export function mapStudentResponse(value: unknown): StudentResponseDto {
  const source = toPlain(value) as PlainObject;
  const id = source.id ?? source._id;
  const firstName = typeof source.firstName === 'string' ? source.firstName : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName : '';

  return {
    id: id == null ? '' : String(id),
    fullName: [firstName, lastName].filter(Boolean).join(' ').trim(),
    firstName,
    lastName,
    phoneNumber:
      typeof source.phoneNumber === 'string' ? source.phoneNumber : undefined,
    telegramId:
      typeof source.telegramId === 'string' ? source.telegramId : undefined,
    parentPhoneNumber:
      typeof source.parentPhoneNumber === 'string'
        ? source.parentPhoneNumber
        : undefined,
    parentName:
      typeof source.parentName === 'string' ? source.parentName : undefined,
    groupIds: stringArray(source.groupIds),
    courseIds: stringArray(source.courseIds),
    branchIds: stringArray(source.branchIds),
    monthlyPayment:
      typeof source.monthlyPayment === 'number'
        ? source.monthlyPayment
        : undefined,
    paymentDueDate: source.paymentDueDate as Date | undefined,
    comment: typeof source.comment === 'string' ? source.comment : undefined,
    isActive: Boolean(source.isActive),
    status: source.status as StudentStatus,
    createdAt: source.createdAt as Date | undefined,
    updatedAt: source.updatedAt as Date | undefined,
  };
}

export function mapStudentResponses(values: unknown[]): StudentResponseDto[] {
  return values.map((value) => mapStudentResponse(value));
}
