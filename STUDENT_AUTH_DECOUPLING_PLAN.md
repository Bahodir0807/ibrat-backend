# Student Auth Decoupling Plan

## Current Legacy Dependency

`Role.Student` is still kept for compatibility in the legacy student auth and student portal path.

Known dependency points:

- `src/roles/roles.enum.ts`: `Role.Student` remains as a legacy enum value.
- `src/auth/auth.service.ts`: `auth/register` still allows `role=student` for legacy self-registration.
- `src/auth/dto/register.dto.ts`: register DTO still accepts `student`.
- `src/users/users.service.ts`: unauthenticated `create()` can still assign `Role.Student` only for legacy register compatibility.
- `src/users/users.service.ts`: student self-read/payment compatibility still treats `Role.Student` as an authenticated actor.
- Some older portal/session flows may still resolve the authenticated student through `UsersService`.

This is intentionally not removed in this refactor because deleting it now would break existing student portal login/session behavior before student credentials exist on the `students` collection.

## Target Model

Students must authenticate against the `students` collection, not `users`.

Add auth fields to `Student`:

- `login` or `username`
- `passwordHash`
- `status`
- `isActive`
- `lastLoginAt`
- `refreshTokenHash` or session collection reference, depending on the current refresh-token model
- optional `passwordChangedAt`

Staff users remain in `users` with roles:

- `owner`
- `admin`
- `branch_admin`
- `teacher`
- `manager`
- `panda`
- `staff`

## Endpoint Changes

Add or migrate:

- `POST /student-auth/login`
- `POST /student-auth/refresh`
- `POST /student-auth/logout`
- `GET /student-auth/me`
- student portal profile endpoints should load through `StudentsService`

Keep temporarily:

- `POST /auth/register` with `role=student`
- existing student portal auth guards that expect `Role.Student`

## Migration Plan

1. Add auth fields to `Student`.
2. Add indexes for `login`/`username` and token/session lookup.
3. Implement `/student-auth/login` using `StudentsService`.
4. Issue student-scoped JWT claims with a distinct subject type, for example `subType=student`.
5. Update student portal guards to accept Student entity claims.
6. Migrate legacy student credentials from `users` to `students`.
7. Run compatibility mode where both old and new login paths work.
8. Disable new `Role.Student` creation through `/auth/register`.
9. Remove legacy `Role.Student` user auth and portal compatibility.
10. Drop or archive old student user credentials after a verified backup.

## Credential Migration

For each legacy `User(role=student)`:

- Match the corresponding `Student` by `_id` first.
- Copy `username`/login to `Student.login`.
- Copy password hash to `Student.passwordHash`.
- Copy active/session state only if still valid.
- Preserve disabled/archived state by mapping to `Student.status` and `isActive`.
- Do not delete the legacy user until login parity is verified on a test database.

## Portal Safety

During migration:

- Student portal should read profile data from `students`.
- Payments, attendance, grades, homework should use `studentId` that points to `students`.
- Legacy `User(role=student)` should only be used for authentication fallback.
- New business logic must not query `User(role=student)`.

## Risks

- JWT subject ambiguity if staff and students share the same `sub` format.
- Existing refresh tokens may need revocation or conversion.
- Old portal code may assume user fields that are not present on Student.
- Credential migration must avoid duplicate usernames/logins.
- Rollout can lock students out if old and new auth paths are not run in parallel first.

## Rollback Plan

1. Keep legacy `Role.Student` auth code until new student auth is verified.
2. Keep a credential migration backup/export.
3. Feature-flag `/student-auth/login` rollout.
4. If failures occur, disable the new student auth flag and route student login back to legacy user auth.
5. Do not delete legacy student users until production login metrics are clean.

## Full Removal Criteria

`Role.Student` can be removed only after:

- All student portal login/session flows use `StudentsService`.
- All student JWTs identify the subject as a Student entity.
- Legacy student user credential migration has been verified.
- No backend or frontend code path queries `User(role=student)`.
- Old compatibility tests are removed or rewritten for Student auth.
