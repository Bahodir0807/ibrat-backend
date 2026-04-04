import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(@Body() dto: CreatePaymentDto, @Request() req) {
    const payment = await this.paymentsService.create(dto);
    this.auditLogService.log({
      action: 'payment.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: payment.id },
      status: 'success',
      metadata: { studentId: dto.student, courseId: dto.courseId },
    });
    return payment;
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getAll(@Query() query: PaymentsListQueryDto) {
    return this.paymentsService.getAll(query);
  }

  @Get('me')
  @Roles(Role.Student, Role.Admin, Role.Owner, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getMyPayments(@Request() req, @Query() query: PaymentsListQueryDto) {
    return this.paymentsService.getByStudent(req.user.userId, query);
  }

  @Get('student/:studentId')
  @Roles(Role.Admin, Role.Owner, Role.Student, Role.Extra)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getByStudent(
    @Param('studentId') studentId: string,
    @Request() req,
    @Query() query: PaymentsListQueryDto,
  ) {
    if (req.user.role === Role.Student && req.user.userId !== studentId) {
      throw new ForbiddenException('Students can only access their own payments');
    }

    return this.paymentsService.getByStudent(studentId, query);
  }

  @Patch(':id/confirm')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async confirm(@Param('id') id: string, @Request() req) {
    const payment = await this.paymentsService.confirmPayment(id);
    this.auditLogService.log({
      action: 'payment.confirm',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return payment;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async delete(@Param('id') id: string, @Request() req) {
    await this.paymentsService.delete(id);
    this.auditLogService.log({
      action: 'payment.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return { success: true, message: 'Payment deleted successfully' };
  }
}
