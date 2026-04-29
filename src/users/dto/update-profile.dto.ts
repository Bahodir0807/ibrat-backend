import { PartialType, PickType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateProfileDto extends PartialType(
  PickType(CreateUserDto, ['email', 'firstName', 'lastName', 'phoneNumber', 'avatarUrl'] as const),
) {}
