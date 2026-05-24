import 'dotenv/config';
import mongoose from 'mongoose';

const mongoUri =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DATABASE_URL ||
  'mongodb://localhost:27017/ibrat';

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const studentSchema = new mongoose.Schema({}, { strict: false, collection: 'students' });

const User = mongoose.model('MigrationUser', userSchema);
const Student = mongoose.model('MigrationStudent', studentSchema);
const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run') || !args.has('--confirm');
const isConfirmed = args.has('--confirm');

function compact(value) {
  return value === undefined || value === null || value === '' ? undefined : value;
}

function mapUserToStudent(user) {
  const createdAt = user.createdAt ?? new Date();
  const updatedAt = new Date();

  return {
    _id: user._id,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phoneNumber: compact(user.phoneNumber),
    telegramId: compact(user.telegramId),
    parentPhoneNumber: compact(user.contactOwner),
    parentName: compact(user.contactOwnerFullName),
    groupIds: [],
    courseIds: [],
    branchIds: Array.isArray(user.branchIds)
      ? user.branchIds
          .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
          .map((id) => new mongoose.Types.ObjectId(String(id)))
      : [],
    monthlyPayment: undefined,
    paymentDueDate: undefined,
    comment: compact(user.studentYear),
    isActive: user.isActive !== false,
    status: user.status === 'inactive' ? 'inactive' : 'active',
    createdAt,
    updatedAt,
  };
}

async function hydrateStudentRelations(studentIds) {
  const [courses, groups] = await Promise.all([
    mongoose.connection.collection('courses').find({ students: { $in: studentIds } }).toArray(),
    mongoose.connection.collection('groups').find({ students: { $in: studentIds } }).toArray(),
  ]);

  const relationMap = new Map(studentIds.map((id) => [String(id), { courseIds: [], groupIds: [] }]));

  for (const course of courses) {
    for (const studentId of course.students ?? []) {
      const relation = relationMap.get(String(studentId));
      if (relation) {
        relation.courseIds.push(course._id);
      }
    }
  }

  for (const group of groups) {
    for (const studentId of group.students ?? []) {
      const relation = relationMap.get(String(studentId));
      if (relation) {
        relation.groupIds.push(group._id);
      }
    }
  }

  return relationMap;
}

async function run() {
  await mongoose.connect(mongoUri);

  const users = await User.find({ role: 'student' }).lean();
  const existingStudents = await Student.find(
    { _id: { $in: users.map((user) => user._id) } },
    { _id: 1 },
  ).lean();
  const existingIds = new Set(existingStudents.map((student) => String(student._id)));

  console.log(`Mode: ${isDryRun ? 'dry-run' : 'confirm'}`);
  console.log(`Found student users: ${users.length}`);
  console.log(`Students already existing with same _id: ${existingIds.size}`);

  if (users.length === 0) {
    console.log('No student users found.');
    await mongoose.disconnect();
    return;
  }

  const studentIds = users.map((user) => user._id);
  const relations = await hydrateStudentRelations(studentIds);
  const operations = users.map((user) => {
    const student = mapUserToStudent(user);
    const relation = relations.get(String(user._id));
    student.courseIds = [...new Set((relation?.courseIds ?? []).map(String))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    student.groupIds = [...new Set((relation?.groupIds ?? []).map(String))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    return {
      updateOne: {
        filter: { _id: user._id },
        update: { $setOnInsert: student },
        upsert: true,
      },
    };
  });

  const referenceCounts = await Promise.all([
    mongoose.connection.collection('courses').countDocuments({ students: { $in: studentIds } }),
    mongoose.connection.collection('groups').countDocuments({ students: { $in: studentIds } }),
    mongoose.connection.collection('schedules').countDocuments({ students: { $in: studentIds } }),
    mongoose.connection.collection('payments').countDocuments({ student: { $in: studentIds } }),
    mongoose.connection.collection('attendances').countDocuments({ user: { $in: studentIds } }),
    mongoose.connection.collection('grades').countDocuments({ user: { $in: studentIds } }),
    mongoose.connection.collection('homeworks').countDocuments({ user: { $in: studentIds } }),
  ]);

  console.log(
    `References found: courses=${referenceCounts[0]}, groups=${referenceCounts[1]}, schedules=${referenceCounts[2]}, payments=${referenceCounts[3]}, attendance=${referenceCounts[4]}, grades=${referenceCounts[5]}, homework=${referenceCounts[6]}`,
  );

  if (isDryRun) {
    console.log('Dry-run only. No students were written and no users were deleted.');
    console.log('Run `npm run migrate:students -- --confirm` after backup/export to apply.');
    await mongoose.disconnect();
    return;
  }

  if (!isConfirmed) {
    throw new Error('Refusing to mutate data without --confirm.');
  }

  const backupCollection = `users_student_backup_${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)}`;
  if (users.length > 0) {
    await mongoose.connection.collection(backupCollection).insertMany(users, {
      ordered: false,
    });
    console.log(`Backup written to collection: ${backupCollection}`);
  }

  const writeResult = await Student.bulkWrite(operations, { ordered: false });
  const deletion = await User.deleteMany({ role: 'student' });

  console.log(`Migrated ${users.length} students.`);
  console.log(`Inserted students: ${writeResult.upsertedCount ?? 0}`);
  console.log(`Matched existing students: ${writeResult.matchedCount ?? 0}`);
  console.log(`Removed ${deletion.deletedCount ?? 0} student users.`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
