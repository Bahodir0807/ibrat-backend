import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('homework')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HomeworkController {
  constructor(
    private readonly hwService: HomeworkService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('me')
  @Roles(Role.Student, Role.Teacher, Role.Admin, Role.Owner)
  async getMine(@Request() req) {
    return this.hwService.getByUser(req.user.userId);
  }

  @Get('user/:userId')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async getByUser(@Param('userId') userId: string, @Request() req) {
    if (req.user.role === Role.Student && req.user.userId !== userId) {
      throw new ForbiddenException('Students can only access their own homework');
    }

    return this.hwService.getByUser(userId);
  }

  @Post()
  @Roles(Role.Admin, Role.Teacher, Role.Owner)
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async create(@Body() dto: CreateHomeworkDto) {
    return this.hwService.create(dto);
  }

  @Patch(':id/complete')
  @Roles(Role.Admin, Role.Teacher, Role.Owner, Role.Student)
  async complete(@Param('id') id: string, @Request() req) {
    const homework = await this.hwService.markComplete(id, {
      userId: req.user.userId,
      role: req.user.role,
    });
    this.auditLogService.log({
      action: 'homework.complete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'homework', id },
      status: 'success',
    });
    return homework;
  }
}
