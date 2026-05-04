import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';
import { PaymentStatus } from '../payment-status.enum';

export type PaymentResponseDto = ApiResourceDto;

export function mapPaymentResponse(value: unknown): PaymentResponseDto {
  const mapped = mapPublicResource<PaymentResponseDto>(value);
  if (!mapped.status) {
    mapped.status = mapped.isConfirmed ? PaymentStatus.Confirmed : PaymentStatus.Pending;
  }
  delete mapped.isConfirmed;
  delete mapped.deletedAt;
  return mapped;
}

export function mapPaymentResponses(values: unknown[]): PaymentResponseDto[] {
  return mapPublicResources<PaymentResponseDto>(values).map(value => mapPaymentResponse(value));
}
