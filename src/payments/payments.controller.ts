import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.Admin, Role.Owner)
  async create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Get()
  @Roles(Role.Admin, Role.Owner)
  async getAll() {
    return this.paymentsService.getAll();
  }

  @Get('me')
  @Roles(Role.Student, Role.Admin, Role.Owner)
  async getMyPayments(@Request() req) {
    return this.paymentsService.getByStudent(req.user.userId);
  }

  @Get('student/:studentId')
  @Roles(Role.Admin, Role.Owner, Role.Student)
  async getByStudent(@Param('studentId') studentId: string, @Request() req) {
    if (req.user.role === Role.Student && req.user.userId !== studentId) {
      throw new ForbiddenException('Students can only access their own payments');
    }

    return this.paymentsService.getByStudent(studentId);
  }

  @Patch(':id/confirm')
  @Roles(Role.Admin, Role.Owner)
  async confirm(@Param('id') id: string) {
    return this.paymentsService.confirmPayment(id);
  }

  @Delete(':id')
  @Roles(Role.Admin, Role.Owner)
  async delete(@Param('id') id: string) {
    return this.paymentsService.delete(id);
  }
}
