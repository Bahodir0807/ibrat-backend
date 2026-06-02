import { Types } from 'mongoose';

export type BranchBackfillPlanInput = {
  discoveredIds: unknown[];
  existingIds: unknown[];
};

export type BranchBackfillPlan = {
  foundBranchIds: string[];
  alreadyExisting: string[];
  missing: string[];
  skippedInvalid: string[];
  documentsToCreate: Array<{
    _id: Types.ObjectId;
    name: string;
    isActive: true;
    status: 'active';
  }>;
};

export type BranchBackfillDocument =
  BranchBackfillPlan['documentsToCreate'][number];

function normalizeId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!Types.ObjectId.isValid(raw)) {
    return null;
  }

  return new Types.ObjectId(raw).toHexString();
}

export function branchFallbackName(branchId: string): string {
  return `Branch ${branchId.slice(-6)}`;
}

export function buildBranchBackfillPlan({
  discoveredIds,
  existingIds,
}: BranchBackfillPlanInput): BranchBackfillPlan {
  const skippedInvalid = [
    ...new Set(
      discoveredIds
        .filter((value) => value !== null && value !== undefined)
        .filter((value) => normalizeId(value) === null)
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  ].sort();

  const foundBranchIds = [
    ...new Set(
      discoveredIds
        .map((value) => normalizeId(value))
        .filter((value): value is string => value !== null),
    ),
  ].sort();

  const existingSet = new Set(
    existingIds
      .map((value) => normalizeId(value))
      .filter((value): value is string => value !== null),
  );
  const alreadyExisting = foundBranchIds
    .filter((branchId) => existingSet.has(branchId))
    .sort();
  const missing = foundBranchIds
    .filter((branchId) => !existingSet.has(branchId))
    .sort();

  return {
    foundBranchIds,
    alreadyExisting,
    missing,
    skippedInvalid,
    documentsToCreate: missing.map((branchId) => ({
      _id: new Types.ObjectId(branchId),
      name: branchFallbackName(branchId),
      isActive: true,
      status: 'active',
    })),
  };
}

export function documentsToWriteForBranchBackfill(
  plan: BranchBackfillPlan,
  dryRun: boolean,
): BranchBackfillDocument[] {
  return dryRun ? [] : plan.documentsToCreate;
}
