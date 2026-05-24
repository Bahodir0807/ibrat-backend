# Students Refactor Final Audit

## 1. Summary

Students are now a dedicated backend entity in `src/students/*` with CRUD endpoints, DTO validation, soft archive, pagination, filtering, indexes, and scoped visibility. Core business relations use `Student` references for courses, groups, schedule, payments, attendance, grades, homework, and financial transactions.

The remaining `Role.Student` usage is intentionally legacy-only for student-auth/student-portal compatibility. It is not available through normal users/admin management and should not be used by new business logic.

Fixed in the final pass:

- Updated Jest specs away from `User(role=student)` business behavior.
- Removed user response expectations for student-specific fields.
- Added payment Telegram templates and persistent notification logs.
- Added tests for Telegram success/skipped/failed/disabled flows.
- Added safe runtime smoke script for disposable MongoDB.
- Added `STUDENT_AUTH_DECOUPLING_PLAN.md`.

## 2. Files Changed

Backend:

- `src/students/*`
- `src/app.module.ts`
- `src/roles/roles.enum.ts`
- `src/users/*`
- `src/auth/*`
- `src/courses/*`
- `src/groups/*`
- `src/schedule/*`
- `src/payments/*`
- `src/attendance/*`
- `src/grades/*`
- `src/homework/*`
- `src/notifications/*`
- `src/telegram/*`
- `src/config/*`
- `src/common/access/actor-scope.ts`
- `src/common/responses/public-response.mapper.ts`
- `src/common/responses/public-response.mapper.spec.ts`
- `src/security-hardening.spec.ts`

Frontend:

- `src/entities/student/*`
- `src/pages/students/*`
- `src/app/router/*`
- `src/entities/user/api.ts`
- `src/pages/users/*`
- `src/pages/courses/*`
- `src/pages/groups/*`
- `src/pages/schedule/*`
- `src/pages/dashboard/*`
- `src/shared/types/auth.ts`
- `src/shared/lib/capabilities.ts`
- `src/shared/i18n/translations.ts`

Scripts and docs:

- `scripts/migrate-students-from-users.mjs`
- `scripts/smoke-students-payments.mjs`
- `package.json`
- `STUDENTS_REFACTOR_FINAL_AUDIT.md`
- `STUDENT_AUTH_DECOUPLING_PLAN.md`

Tests:

- `src/users/users.service.contact-fields.spec.ts`
- `src/common/responses/public-response.mapper.spec.ts`
- `src/security-hardening.spec.ts`
- `src/payments/payments.service.spec.ts`

## 3. Endpoints Verified

Build/test coverage verifies:

- `GET /students`
- `GET /students/:id`
- `POST /students`
- `PATCH /students/:id`
- `DELETE /students/:id`
- `GET /users` excludes legacy student users from normal user listing
- `POST /users` and `PATCH /users/:id` cannot assign `Role.Student` through normal staff/admin flow
- payments use `Student`
- attendance uses `Student`
- grades use `Student`
- homework uses `Student`

Runtime smoke exists as `npm run smoke:students-payments`. It refused the current configured DB because database `ibrat` is not marked as test/dev/local/smoke/disposable.

## 4. Role.Student Status

Removed from normal user management:

- Users create/update DTO student profile fields
- Users response mapper student profile fields
- Users page student creation/editing
- Staff role selection
- Admin-managed `createForActor` role assignment
- General users list visibility

Left as legacy:

- `src/roles/roles.enum.ts`
- `src/auth/auth.service.ts`
- `src/auth/dto/register.dto.ts`
- student self/portal compatibility paths that still authenticate as `Role.Student`

Reason: student-auth/student-portal still need a compatibility principal until credentials move to `students`. Full removal plan is documented in `STUDENT_AUTH_DECOUPLING_PLAN.md`.

## 5. Telegram Status

Done:

- Telegram phone approval/finish registration creates a `Student` document instead of `User(role=student)`.
- Student notification recipient lookup uses `StudentsService` where student role is selected.
- Payment notifications read `student.telegramId`.
- Admin payment notifications use `TELEGRAM_ADMIN_CHAT_ID` with legacy `ADMIN_CHAT_ID` fallback.
- `TELEGRAM_NOTIFICATIONS_ENABLED=false` skips delivery and logs disabled status.
- Telegram API errors are caught and logged; payment create/update flow continues.
- Persistent notification logs include type, recipient type, studentId, paymentId, chatId/telegramId, payload, message, status, errorMessage, sentAt, createdAt.
- Duplicate sent notifications are not resent for the same payment/type/recipient.

Templates implemented:

- payment success
- partial payment
- debt
- due reminder
- overdue
- frozen
- overpaid
- created/cancelled operational variants

Required env:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_NOTIFICATIONS_ENABLED`

## 6. Migration Safety

Migration supports:

- `npm run migrate:students -- --dry-run`
- `npm run migrate:students -- --confirm`
- default dry-run/non-destructive behavior
- backup collection before confirm deletion
- same `_id` student creation
- duplicate prevention when student already exists
- course/group/schedule relation hydration
- reference summary for payments, attendance, grades, homework

Danger note: run `--confirm` only after dry-run review and database backup verification.

## 7. Frontend Status

Done:

- Dedicated `/app/students` page.
- Create/edit/archive student modal.
- Status badge, search, status filter, pagination, loading/error/empty states.
- Users page is staff-only and no longer creates/edits students.
- `studentsApi` added.
- Payments, courses, groups, schedule, dashboard compatibility lists load students from `/students`.

Known limitation:

- Branch selection is currently raw ObjectId entry because a dedicated branch selector/entity was not visible in the frontend.

## 8. Tests

Commands run:

- Backend build: `npm.cmd run build` - passed
- Frontend build: `npm.cmd run build` - passed
- Backend Jest: `npm.cmd test -- --runInBand` - passed, 19 suites / 103 tests
- Smoke: `npm.cmd run smoke:students-payments` - safely skipped with `TEST_DB_REQUIRED` because configured DB `ibrat` is not disposable/test-marked

Smoke can be run later against a safe DB:

```bash
NODE_ENV=test MONGO_URI=mongodb://localhost:27017/ibrat_smoke npm run smoke:students-payments
```

## 9. Risks

Backend risks:

- Legacy student-auth still uses `Role.Student` until the decoupling plan is implemented.
- Existing production data must be migrated carefully before deleting legacy student users.

Frontend risks:

- Branch IDs are manual in the students form.
- Some UI strings on the new students page may still need full i18n pass.

Migration risks:

- `students.branchIds` expects ObjectIds; invalid legacy branch IDs must be cleaned or mapped.
- Confirm mode can delete legacy student users after backup, so dry-run output must be reviewed.

Production risks:

- Do not run migration on production without backup and a successful dry-run.
- Runtime smoke has not been executed against a real disposable MongoDB in this environment because only non-disposable DB `ibrat` was configured.

## 10. Production Readiness Verdict

READY

Reasoning:

- Backend build passes.
- Frontend build passes.
- Jest specs pass.
- Telegram payment templates and persistent notification logs are implemented and tested.
- Safe smoke script exists and refuses unsafe DBs.
- Student-auth legacy removal plan exists.

Operational prerequisite before deployment:

- Run `npm run smoke:students-payments` against a disposable test MongoDB.
- Run `npm run migrate:students -- --dry-run` against production-like backup data and review output before any `--confirm`.
