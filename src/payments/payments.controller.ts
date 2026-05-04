import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { PaymentsListQueryDto } from './dto/payments-list-query.dto';
import { AuditLogService } from '../common/audit/audit-log.service';
import { IdParamDto } from '../common/dto/id-param.dto';
import { StudentIdParamDto } from '../common/dto/student-id-param.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post()
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async create(@Body() dto: CreatePaymentDto, @Request() req) {
    const payment = await this.paymentsService.createForActor(dto, req.user as AuthenticatedUser);
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
  async getAll(@Query() query: PaymentsListQueryDto, @Request() req) {
    return this.paymentsService.getAllForActor(query, req.user as AuthenticatedUser);
  }

  @Get('me')
  @Roles(Role.Student, Role.Admin, Role.Owner, Role.Extra)
  async getMyPayments(@Request() req, @Query() query: PaymentsListQueryDto) {
    return this.paymentsService.getByStudentForActor(
      req.user.userId,
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Get('student/:studentId')
  @Roles(Role.Admin, Role.Owner, Role.Student, Role.Extra)
  async getByStudent(
    @Param() params: StudentIdParamDto,
    @Request() req,
    @Query() query: PaymentsListQueryDto,
  ) {
    return this.paymentsService.getByStudentForActor(
      params.studentId,
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Patch(':id/confirm')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async confirm(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    const payment = await this.paymentsService.confirmPaymentForActor(
      id,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'payment.confirm',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return payment;
  }

  @Patch(':id/cancel')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async cancel(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    const payment = await this.paymentsService.cancelPaymentForActor(
      id,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'payment.cancel',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return payment;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra)
  async delete(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    await this.paymentsService.deleteForActor(id, req.user as AuthenticatedUser);
    this.auditLogService.log({
      action: 'payment.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return { message: 'Payment deleted successfully' };
  }
}
