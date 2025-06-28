import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    Patch,
    Delete,
  } from '@nestjs/common';
  import { PaymentsService } from './payments.service';
  import { CreatePaymentDto } from './dto/create-payments.dto';
  
  @Controller('payments')
  export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}
  
    @Post()
    async create(@Body() dto: CreatePaymentDto) {
      return this.paymentsService.create(dto);
    }
  
    @Get()
    async getAll() {
      return this.paymentsService.getAll();
    }
  
    @Get('student/:studentId')
    async getByStudent(@Param('studentId') studentId: string) {
      return this.paymentsService.getByStudent(studentId);
    }
  
    @Patch(':id/confirm')
    async confirm(@Param('id') id: string) {
      return this.paymentsService.confirmPayment(id);
    }
  
    @Delete(':id')
    async delete(@Param('id') id: string) {
      return this.paymentsService.delete(id);
    }
  }
  