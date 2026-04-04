import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class HandlePhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsNotEmpty()
  requestId: string;
}
