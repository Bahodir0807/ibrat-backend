import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type ScheduleResponseDto = ApiResourceDto;

export function mapScheduleResponse(value: unknown): ScheduleResponseDto {
  return mapPublicResource<ScheduleResponseDto>(value);
}

export function mapScheduleResponses(values: unknown[]): ScheduleResponseDto[] {
  return mapPublicResources<ScheduleResponseDto>(values);
}
