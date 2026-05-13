import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  throw new Error('MONGO_URI is required');
}

const courseSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teacherIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { strict: false, collection: 'courses' },
);

const Course = mongoose.model('CourseTeacherMigrationCourse', courseSchema);

function uniqueObjectIds(values) {
  return [...new Set(
    values
      .filter(Boolean)
      .map(value => String(value))
      .filter(value => mongoose.Types.ObjectId.isValid(value)),
  )].map(value => new mongoose.Types.ObjectId(value));
}

async function main() {
  await mongoose.connect(mongoUri);

  const courses = await Course.find({
    $or: [
      { teacherId: { $exists: true, $ne: null } },
      { teacherIds: { $exists: false } },
    ],
  }).select('_id teacherId teacherIds').lean().exec();

  let updated = 0;
  let unchanged = 0;

  for (const course of courses) {
    const teacherIds = uniqueObjectIds([
      ...(Array.isArray(course.teacherIds) ? course.teacherIds : []),
      course.teacherId,
    ]);

    const current = uniqueObjectIds(Array.isArray(course.teacherIds) ? course.teacherIds : []);
    const changed = teacherIds.length !== current.length
      || teacherIds.some((teacherId, index) => String(teacherId) !== String(current[index]));

    if (!changed) {
      unchanged += 1;
      continue;
    }

    await Course.updateOne(
      { _id: course._id },
      { $set: { teacherIds } },
    ).exec();
    updated += 1;
    console.log(`Updated course ${course._id}: teacherIds=[${teacherIds.map(String).join(',')}]`);
  }

  console.log(`Course teacher migration complete. scanned=${courses.length} updated=${updated} unchanged=${unchanged}`);
}

main()
  .catch(error => {
    console.error('Course teacher migration failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
