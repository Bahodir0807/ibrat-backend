import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../user-status.enum';

export interface PublicUser {
  id: string;
  username: string;
  telegramId?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  status: UserStatus;
  isActive: boolean;
  avatarUrl?: string;
  branchIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
