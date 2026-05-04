import 'dotenv/config';
import mongoose, { Schema, Types } from 'mongoose';
import { hashPassword } from '../src/common/password';
import { Role } from '../src/roles/roles.enum';
import { UserStatus } from '../src/users/user-status.enum';

const mongoUri = process.env.MONGO_URI;
const branchId = process.env.SEED_BRANCH_ID ?? 'default-branch';
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'ChangeMe123!';

if (!mongoUri) {
  throw new Error('MONGO_URI is required for seeding');
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
    branchIds: [String],
  },
  { timestamps: true },
);

const courseSchema = new Schema(
  {
    name: String,
    description: String,
    teacherId: { type: Types.ObjectId, ref: 'User' },
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

async function upsertUser(UserModel: mongoose.Model<any>, data: Record<string, unknown>) {
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

  const owner = await upsertUser(UserModel, {
    username: process.env.SEED_OWNER_USERNAME ?? 'owner',
    email: process.env.SEED_OWNER_EMAIL,
    firstName: 'System',
    lastName: 'Owner',
    role: Role.Owner,
    branchIds: [],
  });
  const admin = await upsertUser(UserModel, {
    username: process.env.SEED_ADMIN_USERNAME ?? 'branch_admin',
    firstName: 'Branch',
    lastName: 'Admin',
    role: Role.Admin,
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
    branchIds: [branchId],
  });

  const course = await CourseModel.findOneAndUpdate(
    { name: 'Sample Course', teacherId: teacher._id },
    {
      name: 'Sample Course',
      description: 'Seed course for initial verification',
      teacherId: teacher._id,
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

  console.log(JSON.stringify({
    owner: owner.username,
    admin: admin.username,
    teacher: teacher.username,
    student: student.username,
    branchId,
  }));
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
