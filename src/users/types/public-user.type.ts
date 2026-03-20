import { Role } from '../../roles/roles.enum';

export interface PublicUser {
  _id: string;
  username: string;
  telegramId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  phoneNumber?: string;
  isActive: boolean;
  avatarUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
