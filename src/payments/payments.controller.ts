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
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async create(@Body() dto: CreatePaymentDto, @Request() req) {
    const payment = await this.paymentsService.create(
      dto,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'payment.create',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: payment.id },
      status: 'success',
      metadata: { studentId: dto.studentId, courseId: dto.courseId },
    });
    return payment;
  }

  @Get()
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async getAll(@Query() query: PaymentsListQueryDto, @Request() req) {
    return this.paymentsService.getAll(
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Get('me')
  @Roles(Role.Student, Role.Admin, Role.Owner, Role.Extra)
  async getMyPayments(@Request() req, @Query() query: PaymentsListQueryDto) {
    query.studentId = req.user.userId;
    return this.paymentsService.getByStudent(
      req.user.userId,
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Get('student/:studentId')
  @Roles(Role.Admin, Role.Owner, Role.Student, Role.Extra, Role.BranchAdmin)
  async getByStudent(
    @Param() params: StudentIdParamDto,
    @Request() req,
    @Query() query: PaymentsListQueryDto,
  ) {
    return this.paymentsService.getByStudent(
      params.studentId,
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Get(':id')
  @Roles(Role.Admin, Role.Owner, Role.Student, Role.Extra, Role.BranchAdmin)
  async getById(@Param() params: IdParamDto, @Request() req) {
    const payment = await this.paymentsService.getById(params.id);
    return payment;
  }

  @Post(':id/add-payment')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async addPayment(
    @Param() params: IdParamDto,
    @Body() dto: { amount: number; method: 'cash' | 'card' | 'transfer'; comment?: string },
    @Request() req,
  ) {
    const payment = await this.paymentsService.addPayment(
      params.id,
      dto.amount,
      dto.method,
      req.user as AuthenticatedUser,
      dto.comment,
    );
    this.auditLogService.log({
      action: 'payment.add_payment',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: params.id },
      status: 'success',
      metadata: { amount: dto.amount, method: dto.method },
    });
    return payment;
  }

  @Patch(':id/freeze')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async freeze(
    @Param() params: IdParamDto,
    @Body() dto: { reason: string; freezeFrom?: Date; freezeTo?: Date },
    @Request() req,
  ) {
    const payment = await this.paymentsService.freezePayment(
      params.id,
      dto.reason,
      dto.freezeFrom,
      dto.freezeTo,
    );
    this.auditLogService.log({
      action: 'payment.freeze',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: params.id },
      status: 'success',
      metadata: { reason: dto.reason },
    });
    return payment;
  }

  @Patch(':id/unfreeze')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async unfreeze(@Param() params: IdParamDto, @Request() req) {
    const payment = await this.paymentsService.unfreezePayment(params.id);
    this.auditLogService.log({
      action: 'payment.unfreeze',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: params.id },
      status: 'success',
    });
    return payment;
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async update(
    @Param() params: IdParamDto,
    @Body() dto: Partial<CreatePaymentDto>,
    @Request() req,
  ) {
    const payment = await this.paymentsService.update(
      params.id,
      dto,
      req.user as AuthenticatedUser,
    );
    this.auditLogService.log({
      action: 'payment.update',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id: params.id },
      status: 'success',
    });
    return payment;
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async delete(@Param() params: IdParamDto, @Request() req) {
    const { id } = params;
    await this.paymentsService.delete(id);
    this.auditLogService.log({
      action: 'payment.delete',
      actor: { id: req.user.userId, role: req.user.role },
      target: { type: 'payment', id },
      status: 'success',
    });
    return { message: 'Payment deleted successfully' };
  }

  @Get('statistics/summary')
  @Roles(Role.Admin, Role.Owner, Role.Extra, Role.BranchAdmin)
  async getStatistics(
    @Query() query: { branchId?: string },
    @Request() req,
  ) {
    return this.paymentsService.getStatistics(
      req.user as AuthenticatedUser,
      query.branchId,
    );
  }
}
