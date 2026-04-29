import { IsMongoId } from 'class-validator';

export class UserIdParamDto {
  @IsMongoId()
  userId: string;
}
