import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';

export interface PublicUser {
  id: string;
  _id: string;
  username: string;
  telegramId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  status: UserStatus;
  phoneNumber?: string;
  isActive: boolean;
  avatarUrl?: string;
  branchIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
