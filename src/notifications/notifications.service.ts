import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { TelegramService } from '../telegram/telegram.service';
import { UsersService } from '../users/users.service';
import { CreateNotificationDto } from './dto/create-notify.dto';
import { Role } from '../roles/roles.enum';
import { NotificationType } from './notification-type.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { mapNotificationResponse } from './dto/notification-response.dto';

@Injectable()
export class NotificationsService {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async sendManualNotification(
    dto: CreateNotificationDto,
    sender?: AuthenticatedUser,
  ) {
    const user = sender
      ? await this.usersService.findNotificationRecipientForActor(dto.userId, sender)
      : await this.usersService.findById(dto.userId);
    if (!user || !user.telegramId) {
      throw new NotFoundException('User not found or Telegram is not connected');
    }

    if (sender?.role === Role.Teacher && user.role !== Role.Student) {
      throw new BadRequestException('Teachers can send notifications only to students');
    }

    const prefix = this.getNotificationPrefix(dto.type);
    await this.telegramService.sendMessage(user.telegramId, `${prefix} ${dto.message}`);

    this.logger.log(
      JSON.stringify({
        event: 'notification.manual.sent',
        sender,
        recipient: { id: user.id, role: user.role },
        type: dto.type,
      }),
    );

    return mapNotificationResponse({ sentTo: user.username, type: dto.type });
  }

  async sendRoleNotification(
    type: NotificationType,
    role: Role,
    message: string,
    sender: AuthenticatedUser,
  ) {
    if (sender.role === Role.Teacher && role !== Role.Student) {
      throw new BadRequestException('Teachers can send role-based notifications only to students');
    }

    const users = await this.usersService.findByRoleForActor(role, sender);
    const telegramIds = users.filter(user => user.telegramId).map(user => user.telegramId!);

    if (!telegramIds.length) {
      return mapNotificationResponse({ success: false, reason: 'No users with Telegram were found for this role' });
    }

    const prefix = this.getNotificationPrefix(type);
    telegramIds.forEach(id => this.telegramService.sendMessage(id, `${prefix} ${message}`));

    this.logger.log(
      JSON.stringify({
        event: 'notification.role.sent',
        senderRole: sender.role,
        senderId: sender.userId,
        targetRole: role,
        type,
        recipients: telegramIds.length,
      }),
    );

    return mapNotificationResponse({ sentTo: telegramIds.length });
  }

  private getNotificationPrefix(type: NotificationType) {
    switch (type) {
      case NotificationType.PAYMENT:
        return '[Payment]';
      case NotificationType.HOMEWORK:
        return '[Homework]';
      case NotificationType.GRADES:
        return '[Grades]';
      case NotificationType.ATTENDANCE:
        return '[Attendance]';
      case NotificationType.GENERAL:
      default:
        return '[Notice]';
    }
  }

  onNotification(callback: (payload: { message: string; telegramIds: number[] }) => void) {
    this.emitter.on('notify', callback);
  }

  emit(message: string, telegramIds: number[]) {
    this.emitter.emit('notify', { message, telegramIds });
  }
}
