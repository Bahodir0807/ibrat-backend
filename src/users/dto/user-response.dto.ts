import { AdminUserDto, mapAdminUser, mapPublicUser, PublicUserDto } from '../../common/responses/public-response.mapper';

export type UserResponseDto = AdminUserDto;
export { AdminUserDto, PublicUserDto };

export function mapUserResponse(value: unknown): UserResponseDto {
  return mapAdminUser(value);
}

export function mapNestedUserResponse(value: unknown): PublicUserDto | string | unknown {
  return mapPublicUser(value);
}
