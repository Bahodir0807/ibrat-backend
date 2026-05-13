import {
  ApiResourceDto,
  mapPublicResource,
  mapPublicResources,
} from '../../common/responses/public-response.mapper';

export type CourseResponseDto = ApiResourceDto;

function getPlainObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  if (typeof (value as { toObject?: () => unknown }).toObject === 'function') {
    const plain = (value as { toObject: () => unknown }).toObject();
    return getPlainObject(plain);
  }

  return value as Record<string, unknown>;
}

export function mapCourseResponse(value: unknown): CourseResponseDto {
  const mapped = mapPublicResource<CourseResponseDto>(value);
  const source = getPlainObject(value);
  if (
    !source ||
    !mapped ||
    typeof mapped !== 'object' ||
    Array.isArray(mapped)
  ) {
    return mapped;
  }

  const teacherIds = Array.isArray(source.teacherIds) ? source.teacherIds : [];
  const legacyTeacher = source.teacherId;
  const teacherRefs =
    teacherIds.length > 0 ? teacherIds : legacyTeacher ? [legacyTeacher] : [];

  mapped.teachers = mapPublicResources(teacherRefs);
  mapped.teacherIds = teacherRefs
    .map((teacher) => {
      if (teacher && typeof teacher === 'object') {
        const teacherObject = teacher as { _id?: unknown; id?: unknown };
        return String(teacherObject._id ?? teacherObject.id ?? '');
      }

      return String(teacher);
    })
    .filter(Boolean);

  if (!mapped.teacherId && mapped.teacherIds.length === 1) {
    mapped.teacherId = mapped.teacherIds[0];
  }

  return mapped;
}

export function mapCourseResponses(values: unknown[]): CourseResponseDto[] {
  return mapPublicResources<CourseResponseDto>(values);
}
