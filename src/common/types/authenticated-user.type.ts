import { Role } from '../../roles/roles.enum';

export type AuthenticatedUser = {
  userId: string;
  role: Role;
  username?: string;
  branchIds?: string[];
};
