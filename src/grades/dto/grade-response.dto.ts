import {
  ApiResourceDto,
  mapPublicResource,
  mapPublicResources,
} from '../../common/responses/public-response.mapper';

export type GradeResponseDto = ApiResourceDto;

export function mapGradeResponse(value: unknown): GradeResponseDto {
  return mapPublicResource<GradeResponseDto>(value);
}

export function mapGradeResponses(values: unknown[]): GradeResponseDto[] {
  return mapPublicResources<GradeResponseDto>(values);
}
