import {
  ApiResourceDto,
  mapPublicResource,
  mapPublicResources,
} from '../../common/responses/public-response.mapper';

export type HomeworkResponseDto = ApiResourceDto;

export function mapHomeworkResponse(value: unknown): HomeworkResponseDto {
  return mapPublicResource<HomeworkResponseDto>(value);
}

export function mapHomeworkResponses(values: unknown[]): HomeworkResponseDto[] {
  return mapPublicResources<HomeworkResponseDto>(values);
}
