import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type GroupResponseDto = ApiResourceDto;

export function mapGroupResponse(value: unknown): GroupResponseDto {
  return mapPublicResource<GroupResponseDto>(value);
}

export function mapGroupResponses(values: unknown[]): GroupResponseDto[] {
  return mapPublicResources<GroupResponseDto>(values);
}
