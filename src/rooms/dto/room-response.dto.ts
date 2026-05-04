import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type RoomResponseDto = ApiResourceDto;

export function mapRoomResponse(value: unknown): RoomResponseDto {
  return mapPublicResource<RoomResponseDto>(value);
}

export function mapRoomResponses(values: unknown[]): RoomResponseDto[] {
  return mapPublicResources<RoomResponseDto>(values);
}
