import 'dotenv/config';
import mongoose, { Schema, Types } from 'mongoose';
import {
  buildBranchBackfillPlan,
  documentsToWriteForBranchBackfill,
} from '../src/branches/branch-backfill.util';

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  'mongodb://localhost:27017/ibrat';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || !args.has('--confirm');

const looseSchema = new Schema({}, { strict: false });
const Branch = mongoose.model('BranchBackfillBranch', looseSchema, 'branches');

const branchSourceCollections = [
  'users',
  'students',
  'courses',
  'groups',
  'payments',
  'schedules',
] as const;

function modelForCollection(collectionName: string) {
  return mongoose.model(
    `BranchBackfill_${collectionName}`,
    looseSchema,
    collectionName,
  );
}

async function distinctBranchValues(collectionName: string): Promise<unknown[]> {
  const model = modelForCollection(collectionName);
  const [branchIds, branchId] = await Promise.all([
    model.distinct('branchIds').exec(),
    model.distinct('branchId').exec(),
  ]);

  return [...branchIds, ...branchId];
}

async function run() {
  await mongoose.connect(mongoUri);

  try {
    const discoveredByCollection: Record<string, number> = {};
    const discoveredValues: unknown[] = [];

    for (const collectionName of branchSourceCollections) {
      const values = await distinctBranchValues(collectionName);
      discoveredByCollection[collectionName] = values.length;
      discoveredValues.push(...values);
    }

    const preliminaryPlan = buildBranchBackfillPlan({
      discoveredIds: discoveredValues,
      existingIds: [],
    });
    const existingBranches = preliminaryPlan.foundBranchIds.length
      ? await Branch.find(
          {
            _id: {
              $in: preliminaryPlan.foundBranchIds.map(
                (branchId) => new Types.ObjectId(branchId),
              ),
            },
          },
          { _id: 1 },
        )
          .lean()
          .exec()
      : [];

    const plan = buildBranchBackfillPlan({
      discoveredIds: discoveredValues,
      existingIds: existingBranches.map((branch) => branch._id),
    });
    const documentsToWrite = documentsToWriteForBranchBackfill(plan, dryRun);

    if (documentsToWrite.length > 0) {
      await Branch.insertMany(documentsToWrite, { ordered: false });
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          sourceCollections: discoveredByCollection,
          foundBranchIds: plan.foundBranchIds,
          foundCount: plan.foundBranchIds.length,
          alreadyExisting: plan.alreadyExisting,
          alreadyExistingCount: plan.alreadyExisting.length,
          plannedCreateIds: plan.missing,
          plannedCreateCount: plan.missing.length,
          createdIds: dryRun ? [] : plan.missing,
          createdCount: dryRun ? 0 : plan.missing.length,
          skippedInvalid: plan.skippedInvalid,
          skippedInvalidCount: plan.skippedInvalid.length,
        },
        null,
        2,
      ),
    );

    if (dryRun) {
      console.log('Dry-run mode. Re-run with --confirm to create branches.');
    }
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
