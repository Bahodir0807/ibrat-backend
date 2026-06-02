import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  'mongodb://localhost:27017/ibrat';

const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run') || !args.has('--confirm');
const isConfirmed = args.has('--confirm');

const paymentSchema = new mongoose.Schema({}, { strict: false, collection: 'payments' });
const Payment = mongoose.model('MigrationPaymentHardening', paymentSchema);

function defaultDueDate(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function calculateStatus(payment, dueDate, now) {
  if (payment.isFrozen) {
    return 'frozen';
  }

  const expectedAmount = Number(payment.expectedAmount ?? 0);
  const paidAmount = Number(payment.paidAmount ?? 0);
  const remainingAmount = Math.max(0, expectedAmount - paidAmount);
  const overpaidAmount = Math.max(0, paidAmount - expectedAmount);

  if (overpaidAmount > 0) return 'overpaid';
  if (paidAmount >= expectedAmount) return 'paid';
  if (remainingAmount > 0 && dueDate.getTime() < now.getTime()) return 'debt';
  if (paidAmount > 0) return 'partial';
  return 'pending';
}

async function run() {
  await mongoose.connect(mongoUri);
  if (!isDryRun && !isConfirmed) {
    throw new Error('Refusing to mutate data without --confirm.');
  }

  const cursor = Payment.find({}, {
    _id: 1,
    year: 1,
    month: 1,
    dueDate: 1,
    expectedAmount: 1,
    paidAmount: 1,
    remainingAmount: 1,
    overpaidAmount: 1,
    status: 1,
    isFrozen: 1,
  })
    .lean()
    .cursor();

  const now = new Date();
  let scanned = 0;
  let changed = 0;
  let dueDateBackfilled = 0;
  let recalculatedAmounts = 0;
  let recalculatedStatus = 0;
  const ops = [];

  for await (const payment of cursor) {
    scanned += 1;

    const dueDate = payment.dueDate instanceof Date
      ? payment.dueDate
      : defaultDueDate(Number(payment.year), Number(payment.month));

    const expectedAmount = Number(payment.expectedAmount ?? 0);
    const paidAmount = Number(payment.paidAmount ?? 0);
    const remainingAmount = Math.max(0, expectedAmount - paidAmount);
    const overpaidAmount = Math.max(0, paidAmount - expectedAmount);
    const status = calculateStatus(payment, dueDate, now);

    const updateSet = {};
    let hasChange = false;

    if (!(payment.dueDate instanceof Date)) {
      updateSet.dueDate = dueDate;
      dueDateBackfilled += 1;
      hasChange = true;
    }

    if (Number(payment.remainingAmount ?? 0) !== remainingAmount) {
      updateSet.remainingAmount = remainingAmount;
      hasChange = true;
    }

    if (Number(payment.overpaidAmount ?? 0) !== overpaidAmount) {
      updateSet.overpaidAmount = overpaidAmount;
      hasChange = true;
    }

    if (payment.status !== status) {
      updateSet.status = status;
      hasChange = true;
    }

    if (hasChange) {
      if ('remainingAmount' in updateSet || 'overpaidAmount' in updateSet) {
        recalculatedAmounts += 1;
      }
      if ('status' in updateSet) {
        recalculatedStatus += 1;
      }
      changed += 1;
      ops.push({
        updateOne: {
          filter: { _id: payment._id },
          update: { $set: updateSet },
        },
      });
    }

    if (ops.length >= 1000) {
      if (!isDryRun) {
        await Payment.bulkWrite(ops, { ordered: false });
      }
      ops.length = 0;
    }
  }

  if (ops.length > 0 && !isDryRun) {
    await Payment.bulkWrite(ops, { ordered: false });
  }

  console.log(`Mode: ${isDryRun ? 'dry-run' : 'confirm'}`);
  console.log(`scanned=${scanned} changed=${changed}`);
  console.log(`dueDateBackfilled=${dueDateBackfilled}`);
  console.log(`recalculatedAmounts=${recalculatedAmounts}`);
  console.log(`recalculatedStatus=${recalculatedStatus}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
