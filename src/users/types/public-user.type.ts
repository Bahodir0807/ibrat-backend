import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';
import { StudentPaymentMethod } from '../student-payment-method.enum';

export interface PublicUser {
  id: string;
  username: string;
  telegramId?: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  phoneNumber?: string;
  status: UserStatus;
  isActive: boolean;
  studentYear?: string;
  paymentMethod?: StudentPaymentMethod;
  contactOwner?: string;
  contactOwnerFullName?: string;
  contactOwnerRelation?: string;
  branchIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
