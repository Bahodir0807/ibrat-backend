import { Body, Controller, Get, Post, Query, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notify.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuditLogService } from '../common/audit/audit-log.service';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { NotificationDeliveriesQueryDto } from './dto/notification-deliveries-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationDeliveriesService: NotificationDeliveriesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('deliveries')
  @Roles(Role.Owner, Role.Admin, Role.Extra)
  findDeliveries(
    @Query() query: NotificationDeliveriesQueryDto,
    @Request() req,
  ) {
    return this.notificationDeliveriesService.findAllForActor(
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async sendNotification(@Body() dto: CreateNotificationDto, @Request() req) {
    const result = await this.notificationsService.sendManualNotification(dto, {
      userId: req.user.userId,
      role: req.user.role,
      branchIds: req.user.branchIds,
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
