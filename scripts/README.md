# Scripts

## Branch Backfill

Use the dry-run first:

```bash
npm run backfill:branches:dry-run
```

Apply missing branch documents after reviewing the dry-run output:

```bash
npm run backfill:branches
```

The branch backfill is idempotent. It creates only missing `branches` documents from existing `branchId` / `branchIds` values, never deletes branches, and never renames existing branches.
