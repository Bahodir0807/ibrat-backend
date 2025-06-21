import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateNotificationDto } from './dto/create-notify.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly usersService: UsersService,
    private readonly telegramService: TelegramService,
  ) {}

  async sendManualNotification(dto: CreateNotificationDto) {
    const user = await this.usersService.findById(dto.userId);

    if (!user || !user.telegramId) {
      throw new NotFoundException('Пользователь не найден или Telegram не подключён');
    }

    await this.telegramService.sendMessage(user.telegramId, dto.message);
    return { success: true, sentTo: user.username };
  }
}
