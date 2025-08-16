import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TelegramService } from '../telegram/telegram.service';
import { UserDocument, UsersService } from '../users/users.service';
import { CreateNotificationDto } from './dto/create-notify.dto';
import { EventEmitter } from 'events';
import { Role } from '../roles/roles.enum';
import { NotificationType } from './notification-type.enum';

@Injectable()
export class NotificationsService {
  private emitter = new EventEmitter();

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async sendManualNotification(dto: CreateNotificationDto & { type: NotificationType }) {
    const user = await this.usersService.findById(dto.userId);
    if (!user || !user.telegramId) throw new NotFoundException('Пользователь не найден или Telegram не подключён');

    const prefix = this.getNotificationPrefix(dto.type);
    await this.telegramService.sendMessage(user.telegramId, `${prefix} ${dto.message}`);

    return { success: true, sentTo: user.username, type: dto.type };
  }

  async sendRoleNotification(
    type: NotificationType,
    role: Role,
    message: string,
    senderRole: Role
  ) {
    if (senderRole === Role.Teacher && role !== Role.Student) {
      throw new BadRequestException('Учитель может отправлять уведомления только своим ученикам');
    }
  
    const users = await this.usersService.findByRole(role);
    const telegramIds = users.filter((u: UserDocument) => u.telegramId).map(u => u.telegramId!);
  
    if (!telegramIds.length) return { success: false, reason: 'Нет пользователей с такой ролью' };
  
    const prefix = this.getNotificationPrefix(type);
    telegramIds.forEach(id => this.telegramService.sendMessage(id, `${prefix} ${message}`));
  
    return { success: true, sentTo: telegramIds.length };
  }
  

  private getNotificationPrefix(type: NotificationType) {
    switch (type) {
      case NotificationType.PAYMENT: return '💰 [Оплата]';
      case NotificationType.HOMEWORK: return '📝 [Домашка]';
      case NotificationType.GRADES: return '📊 [Оценки]';
      case NotificationType.ATTENDANCE: return '📅 [Посещаемость]';
      case NotificationType.GENERAL:
      default: return '📢';
    }
  }

  onNotification(callback: (payload: { message: string; telegramIds: number[] }) => void) {
    this.emitter.on('notify', callback);
  }

  emit(message: string, telegramIds: number[]) {
    this.emitter.emit('notify', { message, telegramIds });
  }
}
