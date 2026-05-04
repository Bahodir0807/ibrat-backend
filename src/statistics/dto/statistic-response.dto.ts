import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type StatisticResponseDto = ApiResourceDto;

export function mapStatisticResponse(value: unknown): StatisticResponseDto {
  return mapPublicResource<StatisticResponseDto>(value);
}

export function mapStatisticResponses(values: unknown[]): StatisticResponseDto[] {
  return mapPublicResources<StatisticResponseDto>(values);
}
