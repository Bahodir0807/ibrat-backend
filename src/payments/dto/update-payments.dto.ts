import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentDto } from './create-payments.dto';

export class UpdatePaymentsDto extends PartialType(CreatePaymentDto) {}
