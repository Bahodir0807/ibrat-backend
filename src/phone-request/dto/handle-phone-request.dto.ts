import { IsIn, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class HandlePhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsMongoId()
  requestId: string;
}
