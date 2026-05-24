import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';

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
  branchIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
