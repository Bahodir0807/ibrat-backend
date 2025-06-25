import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreateNotificationDto } from './dto/create-notify.dto';
import { EventEmitter } from 'node:events';

@Injectable()
export class NotificationsService {
  private emitter = new EventEmitter();

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => TelegramService))
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

  onNotification(callback: (payload: { message: string; telegramIds: number[] }) => void) {
    this.emitter.on('notify', callback);
  }

  emit(message: string, telegramIds: number[]) {
    this.emitter.emit('notify', { message, telegramIds });
  }
}
