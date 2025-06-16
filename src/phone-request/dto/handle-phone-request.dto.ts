import { IsString, IsNotEmpty } from 'class-validator';

export class HandlePhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  status: 'approved' | 'rejected';

  @IsString()
  @IsNotEmpty()
  requestId: string;
}
