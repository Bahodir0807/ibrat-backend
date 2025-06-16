import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @IsString()
  @IsOptional()
  status?: 'pending' | 'approved' | 'rejected';
}
