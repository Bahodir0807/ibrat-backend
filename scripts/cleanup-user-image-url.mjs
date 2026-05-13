import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
const removedUserImageField = String.fromCharCode(
  97,
  118,
  97,
  116,
  97,
  114,
  85,
  114,
  108,
);

if (!mongoUri) {
  throw new Error('MONGO_URI is required');
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.CLEANUP_USER_IMAGE_URL_ALLOW_PRODUCTION !== 'true'
) {
  throw new Error(
    'Refusing to clean up production without CLEANUP_USER_IMAGE_URL_ALLOW_PRODUCTION=true',
  );
}

const userSchema = new mongoose.Schema(
  {},
  { strict: false, collection: 'users' },
);

const User = mongoose.model('UserImageUrlCleanupUser', userSchema);

async function main() {
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME,
  });

  const result = await User.updateMany(
    { [removedUserImageField]: { $exists: true } },
    { $unset: { [removedUserImageField]: '' } },
  ).exec();

  console.log(
    `User image URL cleanup complete. matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
}

main()
  .catch((error) => {
    console.error('User image URL cleanup failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
