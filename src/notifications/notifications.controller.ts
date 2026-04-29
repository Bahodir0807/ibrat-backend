import { Body, Controller, Post, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notify.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Extra)
  async sendNotification(@Body() dto: CreateNotificationDto, @Request() req) {
    const result = await this.notificationsService.sendManualNotification(dto, {
      userId: req.user.userId,
      role: req.user.role,
    });

    this.auditLogService.log({
      action: 'notification.send',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'user', id: dto.userId },
      status: 'success',
      metadata: { type: dto.type },
    });

    return result;
  }
}
