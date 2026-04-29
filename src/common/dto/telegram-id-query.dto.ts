import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class TelegramIdQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'telegramId must contain only digits' })
  telegramId: string;
}
