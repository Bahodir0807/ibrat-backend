import { UserStatus } from './user-status.enum';

type UserStatusLike = {
  status?: UserStatus;
  isActive?: boolean;
};

export function resolveUserStatus(user: UserStatusLike): UserStatus {
  if (user.status && Object.values(UserStatus).includes(user.status)) {
    return user.status;
  }

  return user.isActive === false ? UserStatus.Inactive : UserStatus.Active;
}

export function canAuthenticateWithStatus(status: UserStatus): boolean {
  return status === UserStatus.Active;
}

export function statusToIsActive(status: UserStatus): boolean {
  return status === UserStatus.Active;
}
