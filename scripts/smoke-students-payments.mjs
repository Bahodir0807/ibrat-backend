import 'dotenv/config';
import mongoose from 'mongoose';

const SAFE_DB_PATTERN = /(test|dev|local|smoke|disposable)/i;
const runId = `students-smoke-${Date.now()}`;

function fail(message, code = 1) {
  console.error(`[smoke:students-payments] ${message}`);
  process.exit(code);
}

function getDatabaseName(uri) {
  const explicitDb = process.env.MONGO_DB_NAME?.trim();
  if (explicitDb) {
    return explicitDb;
  }

  const withoutQuery = uri.split('?')[0] ?? '';
  const dbName = withoutQuery.substring(withoutQuery.lastIndexOf('/') + 1);
  return dbName || undefined;
}

async function cleanup(db, ids) {
  const collections = [
    'homeworks',
    'grades',
    'attendances',
    'payments',
    'financialtransactions',
    'students',
    'groups',
    'courses',
    'branches',
  ];

  await Promise.all(
    collections.map((name) =>
      db.collection(name).deleteMany({
        $or: [{ _smokeRunId: runId }, { _id: { $in: ids } }],
      }),
    ),
  );
}

if (process.env.NODE_ENV === 'production') {
  fail('Refusing to run with NODE_ENV=production.');
}

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  fail('TEST_DB_REQUIRED: set MONGO_URI or MONGODB_URI to a disposable test database.', 0);
}

const dbName = getDatabaseName(mongoUri);
if (!dbName || !SAFE_DB_PATTERN.test(dbName)) {
  fail(
    `TEST_DB_REQUIRED: database "${dbName ?? '<unknown>'}" is not marked as test/dev/local/smoke/disposable.`,
    0,
  );
}

const ids = {
  branch: new mongoose.Types.ObjectId(),
  course: new mongoose.Types.ObjectId(),
  group: new mongoose.Types.ObjectId(),
  student: new mongoose.Types.ObjectId(),
  payment: new mongoose.Types.ObjectId(),
  attendance: new mongoose.Types.ObjectId(),
  grade: new mongoose.Types.ObjectId(),
  homework: new mongoose.Types.ObjectId(),
};

const idList = Object.values(ids);

try {
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || undefined,
    autoIndex: false,
  });

  const db = mongoose.connection.db;
  await cleanup(db, idList);

  await db.collection('branches').insertOne({
    _id: ids.branch,
    name: 'Smoke Branch',
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('courses').insertOne({
    _id: ids.course,
    name: 'Smoke Course',
    price: 100,
    students: [ids.student],
    branchIds: [ids.branch],
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('groups').insertOne({
    _id: ids.group,
    name: 'Smoke Group',
    course: ids.course,
    students: [ids.student],
    branchIds: [ids.branch],
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('students').insertOne({
    _id: ids.student,
    firstName: 'Smoke',
    lastName: 'Student',
    phoneNumber: '+100000000',
    telegramId: '123456789',
    groupIds: [ids.group],
    courseIds: [ids.course],
    branchIds: [ids.branch],
    monthlyPayment: 100,
    paymentDueDate: new Date(),
    comment: runId,
    isActive: true,
    status: 'active',
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const listedActive = await db
    .collection('students')
    .find({ _id: ids.student, isActive: true })
    .toArray();
  if (listedActive.length !== 1) {
    throw new Error('Active student was not found after create.');
  }

  await db.collection('students').updateOne(
    { _id: ids.student },
    { $set: { phoneNumber: '+200000000', updatedAt: new Date() } },
  );
  const updatedStudent = await db.collection('students').findOne({
    _id: ids.student,
    phoneNumber: '+200000000',
  });
  if (!updatedStudent) {
    throw new Error('Student update verification failed.');
  }

  await db.collection('payments').insertOne({
    _id: ids.payment,
    student: ids.student,
    course: ids.course,
    amount: 100,
    status: 'pending',
    isConfirmed: false,
    method: 'cash',
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.collection('payments').updateOne(
    { _id: ids.payment },
    {
      $set: {
        status: 'confirmed',
        isConfirmed: true,
        paidAt: new Date(),
        confirmedAt: new Date(),
      },
    },
  );

  await db.collection('attendances').insertOne({
    _id: ids.attendance,
    student: ids.student,
    course: ids.course,
    group: ids.group,
    date: new Date(),
    status: 'present',
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('grades').insertOne({
    _id: ids.grade,
    student: ids.student,
    course: ids.course,
    group: ids.group,
    grade: 5,
    value: 5,
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.collection('homeworks').insertOne({
    _id: ids.homework,
    student: ids.student,
    course: ids.course,
    group: ids.group,
    title: 'Smoke Homework',
    status: 'assigned',
    _smokeRunId: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const populatedPayment = await db
    .collection('payments')
    .aggregate([
      { $match: { _id: ids.payment } },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentData',
        },
      },
      { $unwind: '$studentData' },
    ])
    .next();
  if (populatedPayment?.studentData?.firstName !== 'Smoke') {
    throw new Error('Payment student populate verification failed.');
  }

  await db.collection('students').updateOne(
    { _id: ids.student },
    { $set: { isActive: false, status: 'archived', updatedAt: new Date() } },
  );
  const activeAfterArchive = await db
    .collection('students')
    .countDocuments({ _id: ids.student, isActive: true });
  if (activeAfterArchive !== 0) {
    throw new Error('Archived student still appears in active list.');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        database: dbName,
        checks: [
          'branch/course/group seed',
          'student create/list/update/archive',
          'payment create/confirm',
          'attendance create',
          'grade create',
          'homework create',
          'payment student lookup',
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    `[smoke:students-payments] failed: ${
      error instanceof Error ? error.stack : String(error)
    }`,
  );
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState === 1) {
    await cleanup(mongoose.connection.db, idList).catch((error) => {
      console.error(
        `[smoke:students-payments] cleanup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
  await mongoose.disconnect().catch(() => undefined);
}
