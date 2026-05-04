# Role Naming Cleanup Plan

Current roles are kept for backward compatibility:

- `owner`: system-wide owner/superadmin behavior.
- `admin`: branch-scoped administrator behavior.
- `panda`: extra system-wide role.
- `teacher`, `student`, `guest`: domain roles.

Recommended migration:

1. Add new enum aliases without changing stored values:
   - `SuperAdmin` -> `owner`
   - `BranchAdmin` -> `admin`
   - `SystemOperator` -> `panda`
2. Update code references to use the new enum names while keeping serialized values unchanged.
3. Add migration telemetry/logging to find active `panda` users.
4. Backfill role values only after clients and tokens are updated:
   - `owner` -> `superadmin`
   - `admin` -> `branch_admin`
   - `panda` -> `system_operator` or remove.
5. Rotate JWTs after persisted role values change.

Do not rename stored role values in-place without a token/client migration window.
