import { Types } from 'mongoose';
import {
  branchFallbackName,
  buildBranchBackfillPlan,
  documentsToWriteForBranchBackfill,
} from './branch-backfill.util';

const objectId = () => new Types.ObjectId().toHexString();

describe('branch backfill util', () => {
  it('does not create duplicates for existing branches', () => {
    const existing = objectId();

    const plan = buildBranchBackfillPlan({
      discoveredIds: [existing, existing, new Types.ObjectId(existing)],
      existingIds: [existing],
    });

    expect(plan.foundBranchIds).toEqual([existing]);
    expect(plan.alreadyExisting).toEqual([existing]);
    expect(plan.missing).toEqual([]);
    expect(plan.documentsToCreate).toEqual([]);
  });

  it('creates missing branch documents with safe fallback names', () => {
    const missing = objectId();

    const plan = buildBranchBackfillPlan({
      discoveredIds: [missing],
      existingIds: [],
    });

    expect(plan.missing).toEqual([missing]);
    expect(plan.documentsToCreate).toEqual([
      {
        _id: expect.any(Types.ObjectId),
        name: branchFallbackName(missing),
        isActive: true,
        status: 'active',
      },
    ]);
    expect(String(plan.documentsToCreate[0]._id)).toBe(missing);
  });

  it('skips invalid branch ids', () => {
    const valid = objectId();

    const plan = buildBranchBackfillPlan({
      discoveredIds: [valid, 'bad-id', '', null, undefined],
      existingIds: [],
    });

    expect(plan.foundBranchIds).toEqual([valid]);
    expect(plan.skippedInvalid).toEqual(['bad-id']);
  });

  it('returns planned documents without implying writes for dry-run callers', () => {
    const missing = objectId();

    const plan = buildBranchBackfillPlan({
      discoveredIds: [missing],
      existingIds: [],
    });

    expect(plan.documentsToCreate).toHaveLength(1);
    expect(plan.missing).toHaveLength(1);
    expect(documentsToWriteForBranchBackfill(plan, true)).toEqual([]);
    expect(documentsToWriteForBranchBackfill(plan, false)).toHaveLength(1);
  });
});
