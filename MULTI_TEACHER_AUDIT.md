# Multi-Teacher Course Audit

## Scope

This repository contains the NestJS/Mongoose backend only. No React/TypeScript frontend files, frontend package, Vite/Next config, Zod schemas, Yup schemas, or React Query code were present in this workspace, so frontend implementation must happen in the separate frontend repository.

## Backend Changes

- `Course.teacherIds` is now the canonical multi-teacher field.
- Legacy `Course.teacherId` is still accepted by DTOs and read paths for backward compatibility.
- Create/update DTOs accept `teacherIds: string[]`, validate Mongo ids, and prevent duplicate values.
- Course create/update normalizes legacy `teacherId` into `teacherIds`.
- Course responses expose:
  - `teachers`: public teacher objects
  - `teacherIds`: teacher id strings
  - `teacherId`: legacy single-teacher compatibility value when exactly one teacher exists
- Teacher course access now checks whether the current teacher id is contained in `course.teacherIds`.
- Course filtering by `teacherId` now filters by `teacherIds` containment.
- Group and schedule validation now require the assigned group/schedule teacher to be one of the related course teachers.
- Teacher-visible student lookups in users/homework/grades include both `teacherIds` and legacy `teacherId`.
- Demo/seed scripts now write `teacherIds`.
- Added `scripts/migrate-course-teachers.mjs` and `npm run migrate:course-teachers`.

## Architecture Decision

Groups and schedule entries keep their existing single assigned `teacher` field.

Reasoning: a course can have multiple eligible teachers, while a concrete group or lesson still needs one accountable assigned teacher for conflict checks, attendance ownership, schedule lookup, and existing API compatibility. Group/schedule creation now validates that this assigned teacher belongs to the course `teacherIds` set.

## Changed Files

- `src/courses/schemas/course.schema.ts`
- `src/courses/dto/create-course.dto.ts`
- `src/courses/dto/courses-list-query.dto.ts`
- `src/courses/dto/course-response.dto.ts`
- `src/courses/courses.service.ts`
- `src/courses/courses.service.spec.ts`
- `src/groups/groups.service.ts`
- `src/schedule/schedule.service.ts`
- `src/users/users.service.ts`
- `src/homework/homework.service.ts`
- `src/grades/grades.service.ts`
- `src/common/responses/public-response.mapper.ts`
- `src/pre-production-role-access.spec.ts`
- `scripts/seed.ts`
- `scripts/create-demo-data.mjs`
- `scripts/create-real-demo-data.mjs`
- `scripts/migrate-course-teachers.mjs`
- `package.json`

## Risky Areas

- Existing frontend code in a separate repo may still send or render only `teacherId`.
- Existing course documents need migration before removing old `teacherId` assumptions.
- Statistics metadata still uses `teacherId` because statistics records are metadata-based and not course ownership records.
- Groups and schedule remain single assigned teacher by design; changing them to multi-teacher would be a larger scheduling/ownership model change.

## Migration Notes

Run:

```bash
npm run migrate:course-teachers
```

The migration is idempotent. It preserves existing `teacherIds`, appends legacy `teacherId` when present, removes duplicates, and logs updated courses.

## Frontend Work Required In Separate Repo

- Replace single course teacher select with a searchable multi-select backed by teacher users.
- Send `teacherIds` on create/update.
- Tolerate temporary API shapes: `teachers`, `teacherIds`, or legacy `teacherId`.
- Update course cards/tables/details to render multiple teachers as `Teacher A, Teacher B +2`.
- Update teacher filters to query by containing teacher id.
- Update frontend API types from `teacherId` to `teacherIds`, keeping `teacherId?` during transition.
- Verify React Query invalidation keys for create/update course mutations.

## Remaining Technical Debt

- Remove legacy `teacherId` from schema and response after migration and frontend rollout are complete.
- Add e2e API tests when a real test database harness is available.
- Consider adding a dedicated public course response DTO instead of response-shape normalization in the mapper.
