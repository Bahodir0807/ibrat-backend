import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type AttendanceResponseDto = ApiResourceDto;

export function mapAttendanceResponse(value: unknown): AttendanceResponseDto {
  return mapPublicResource<AttendanceResponseDto>(value);
}

export function mapAttendanceResponses(values: unknown[]): AttendanceResponseDto[] {
  return mapPublicResources<AttendanceResponseDto>(values);
}
