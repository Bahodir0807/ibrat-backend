import { existsSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import mongoose, { Schema, Types } from 'mongoose';
import { hashPassword } from '../src/common/password';
import { Role } from '../src/roles/roles.enum';
import { UserStatus } from '../src/users/user-status.enum';

function loadSeedEnv() {
  const nodeEnv = process.env.NODE_ENV;
  const candidates = [
    nodeEnv ? `.env.${nodeEnv}.local` : undefined,
    nodeEnv ? `.env.${nodeEnv}` : undefined,
    '.env.local',
    '.env',
  ].filter((value): value is string => Boolean(value));

  for (const path of candidates) {
    if (existsSync(path)) {
      loadEnv({ path, override: false });
    }
  }
}

loadSeedEnv();

const mongoUri = process.env.MONGO_URI;
const branchId = process.env.SEED_BRANCH_ID ?? 'default-branch';
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';

if (!mongoUri) {
  throw new Error('MONGO_URI is required for seeding');
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.SEED_ALLOW_PRODUCTION !== 'true'
) {
  throw new Error(
    'Refusing to seed production without SEED_ALLOW_PRODUCTION=true',
  );
}

const userSchema = new Schema(
  {
    username: { type: String, unique: true },
    email: { type: String, unique: true, sparse: true },
    password: String,
    firstName: String,
    lastName: String,
    role: String,
    status: String,
    isActive: Boolean,
    studentYear: String,
    paymentMethod: String,
    contactOwner: String,
    contactOwnerFullName: String,
    contactOwnerRelation: String,
    branchIds: [String],
  },
  { timestamps: true },
);

const courseSchema = new Schema(
  {
    name: String,
    description: String,
    teacherId: { type: Types.ObjectId, ref: 'User' },
    teacherIds: [{ type: Types.ObjectId, ref: 'User' }],
    students: [{ type: Types.ObjectId, ref: 'User' }],
    price: Number,
  },
  { timestamps: true },
);

const groupSchema = new Schema(
  {
    name: String,
    course: { type: Types.ObjectId, ref: 'Course' },
    teacher: { type: Types.ObjectId, ref: 'User' },
    students: [{ type: Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

const roomSchema = new Schema(
  {
    name: String,
    capacity: Number,
    type: String,
    isAvailable: Boolean,
    description: String,
  },
  { timestamps: true },
);

const scheduleSchema = new Schema(
  {
    course: { type: Types.ObjectId, ref: 'Course' },
    room: { type: Types.ObjectId, ref: 'Room' },
    date: Date,
    timeStart: Date,
    timeEnd: Date,
    students: [{ type: Types.ObjectId, ref: 'User' }],
    group: { type: Types.ObjectId, ref: 'Group' },
    teacher: { type: Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const paymentSchema = new Schema(
  {
    student: { type: Types.ObjectId, ref: 'User' },
    course: { type: Types.ObjectId, ref: 'Course' },
    amount: Number,
    paidAt: Date,
    status: String,
    isConfirmed: Boolean,
    method: String,
  },
  { timestamps: true },
);

const attendanceSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User' },
  schedule: { type: Types.ObjectId, ref: 'Schedule' },
  date: Date,
  status: String,
});

const gradeSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User' },
  subject: String,
  score: Number,
  date: Date,
});

const homeworkSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User' },
    date: Date,
    tasks: [String],
    completed: Boolean,
  },
  { timestamps: true },
);

async function upsertUser(
  UserModel: mongoose.Model<any>,
  data: Record<string, unknown>,
) {
  const existing = await UserModel.findOne({ username: data.username }).exec();
  if (existing) {
    return existing;
  }

  return UserModel.create({
    ...data,
    password: await hashPassword(defaultPassword),
    status: UserStatus.Active,
    isActive: true,
  });
}

async function main() {
  await mongoose.connect(mongoUri!, {
    dbName: process.env.MONGO_DB_NAME,
  });

  const UserModel = mongoose.model('User', userSchema);
  const CourseModel = mongoose.model('Course', courseSchema);
  const GroupModel = mongoose.model('Group', groupSchema);
  const RoomModel = mongoose.model('Room', roomSchema);
  const ScheduleModel = mongoose.model('Schedule', scheduleSchema);
  const PaymentModel = mongoose.model('Payment', paymentSchema);
  const AttendanceModel = mongoose.model('Attendance', attendanceSchema);
  const GradeModel = mongoose.model('Grade', gradeSchema);
  const HomeworkModel = mongoose.model('Homework', homeworkSchema);

  const owner = await upsertUser(UserModel, {
    username: process.env.SEED_OWNER_USERNAME ?? 'owner',
    email: process.env.SEED_OWNER_EMAIL,
    firstName: 'System',
    lastName: 'Owner',
    role: Role.Owner,
    branchIds: [],
  });
  const admin = await upsertUser(UserModel, {
    username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
    firstName: 'Branch',
    lastName: 'Admin',
    role: Role.Admin,
    branchIds: [branchId],
  });
  const panda = await upsertUser(UserModel, {
    username: process.env.SEED_PANDA_USERNAME ?? 'panda',
    firstName: 'Panda',
    lastName: 'Operator',
    role: Role.Extra,
    branchIds: [branchId],
  });
  const teacher = await upsertUser(UserModel, {
    username: process.env.SEED_TEACHER_USERNAME ?? 'teacher',
    firstName: 'Sample',
    lastName: 'Teacher',
    role: Role.Teacher,
    branchIds: [branchId],
  });
  const student = await upsertUser(UserModel, {
    username: process.env.SEED_STUDENT_USERNAME ?? 'student',
    firstName: 'Sample',
    lastName: 'Student',
    role: Role.Student,
    studentYear: '2026',
    paymentMethod: 'cash',
    contactOwner: "o'zi",
    contactOwnerFullName: 'Sample Student',
    contactOwnerRelation: "o'zi",
    branchIds: [branchId],
  });

  const course = await CourseModel.findOneAndUpdate(
    { name: 'Sample Course', teacherIds: teacher._id },
    {
      name: 'Sample Course',
      description: 'Seed course for initial verification',
      teacherId: teacher._id,
      teacherIds: [teacher._id],
      students: [student._id],
      price: 100,
    },
    { upsert: true, new: true },
  ).exec();

  await GroupModel.findOneAndUpdate(
    { name: 'Sample Group', course: course._id },
    {
      name: 'Sample Group',
      course: course._id,
      teacher: teacher._id,
      students: [student._id],
    },
    { upsert: true, new: true },
  ).exec();

  const room = await RoomModel.findOneAndUpdate(
    { name: 'QA Room 101' },
    {
      name: 'QA Room 101',
      capacity: 18,
      type: 'classroom',
      isAvailable: true,
      description: 'QA seed room for isolated demo flows',
    },
    { upsert: true, new: true },
  ).exec();

  const now = new Date();
  const start = new Date(now);
  start.setHours(10, 0, 0, 0);
  const end = new Date(now);
  end.setHours(11, 30, 0, 0);

  const schedule = await ScheduleModel.findOneAndUpdate(
    { course: course._id, teacher: teacher._id, room: room._id, date: start },
    {
      course: course._id,
      room: room._id,
      date: start,
      timeStart: start,
      timeEnd: end,
      students: [student._id],
      group: (
        await GroupModel.findOne({
          name: 'Sample Group',
          course: course._id,
        }).exec()
      )?._id,
      teacher: teacher._id,
    },
    { upsert: true, new: true },
  ).exec();

  await PaymentModel.findOneAndUpdate(
    { student: student._id, course: course._id },
    {
      student: student._id,
      course: course._id,
      amount: 100,
      paidAt: now,
      status: 'pending',
      isConfirmed: false,
      method: 'qa-seed',
    },
    { upsert: true, new: true },
  ).exec();

  await AttendanceModel.findOneAndUpdate(
    { user: student._id, schedule: schedule._id },
    {
      user: student._id,
      schedule: schedule._id,
      date: now,
      status: 'present',
    },
    { upsert: true, new: true },
  ).exec();

  await GradeModel.findOneAndUpdate(
    { user: student._id, subject: 'QA English' },
    {
      user: student._id,
      subject: 'QA English',
      score: 88,
      date: now,
    },
    { upsert: true, new: true },
  ).exec();

  await HomeworkModel.findOneAndUpdate(
    { user: student._id, date: start },
    {
      user: student._id,
      date: start,
      tasks: ['Read unit 1', 'Complete QA worksheet'],
      completed: false,
    },
    { upsert: true, new: true },
  ).exec();

  console.log(
    JSON.stringify({
      owner: owner.username,
      admin: admin.username,
      panda: panda.username,
      teacher: teacher.username,
      student: student.username,
      branchId,
    }),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
