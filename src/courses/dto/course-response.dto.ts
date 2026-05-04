import { ApiResourceDto, mapPublicResource, mapPublicResources } from '../../common/responses/public-response.mapper';

export type CourseResponseDto = ApiResourceDto;

export function mapCourseResponse(value: unknown): CourseResponseDto {
  return mapPublicResource<CourseResponseDto>(value);
}

export function mapCourseResponses(values: unknown[]): CourseResponseDto[] {
  return mapPublicResources<CourseResponseDto>(values);
}
