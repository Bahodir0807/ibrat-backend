import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentsDto } from './create-payments.dto';

export class UpdatePaymentsDto extends PartialType(CreatePaymentsDto) {}
