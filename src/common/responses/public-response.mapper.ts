import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../../users/user-status.enum';

type PlainObject = Record<string, unknown>;
export type ApiResourceDto = { id?: string; [key: string]: any };

const SENSITIVE_KEYS = new Set([
  '__v',
  '_id',
  'password',
  'hashedPassword',
  'passwordChangedAt',
  'email',
  'phoneNumber',
  'telegramId',
  'accessToken',
  'refreshToken',
  'tokens',
  'tokenHash',
  'token',
  'deletedAt',
  'privateNotes',
  'privateNote',
  'internalMetadata',
  'metadata',
  'sessionId',
  'sessionIds',
  'resetToken',
  'resetPasswordToken',
]);

const USER_REFERENCE_KEYS = new Set([
  'user',
  'student',
  'students',
  'teacher',
  'teacherId',
  'teacherIds',
  'teachers',
]);

export type PublicUserDto = {
  id: string;
  fullName: string;
  role?: Role;
};

export type AdminUserDto = PublicUserDto & {
  username: string;
  telegramId?: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: Role;
  phoneNumber?: string;
  status: UserStatus;
  isActive: boolean;
  branchIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item));
  }

  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toHexString?: () => string }).toHexString === 'function'
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }

  if (!isPlainObject(value) || value instanceof Date) {
    return value;
  }

  if (typeof (value as { toObject?: () => unknown }).toObject === 'function') {
    return toPlain((value as { toObject: () => unknown }).toObject());
  }

  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }

  const result: PlainObject = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    result[key] = toPlain(nestedValue);
  }

  return result;
}

function getId(source: PlainObject): string | undefined {
  const id = source.id ?? source._id;
  return id == null ? undefined : String(id);
}

function getFullName(source: PlainObject): string {
  const firstName =
    typeof source.firstName === 'string' ? source.firstName.trim() : '';
  const lastName =
    typeof source.lastName === 'string' ? source.lastName.trim() : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  return typeof source.username === 'string' ? source.username : '';
}

function looksLikeUser(value: unknown): value is PlainObject {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    'role' in value ||
    'username' in value ||
    'firstName' in value ||
    'lastName' in value
  );
}

export function mapPublicUser(
  value: unknown,
): PublicUserDto | string | unknown {
  const source = toPlain(value);
  if (!isPlainObject(source)) {
    return source;
  }

  const id = getId(source);
  if (!id) {
    return undefined;
  }

  const mapped: PublicUserDto = {
    id,
    fullName: getFullName(source),
  };

  if (typeof source.role === 'string') {
    mapped.role = source.role as Role;
  }

  return mapped;
}

export function mapAdminUser(value: unknown): AdminUserDto {
  const source = toPlain(value);
  if (!isPlainObject(source)) {
    return {
      id: '',
      fullName: '',
      username: '',
      firstName: '',
      lastName: '',
      role: undefined as unknown as Role,
      status: undefined as unknown as UserStatus,
      isActive: false,
      branchIds: [],
    };
  }

  const mapped: AdminUserDto = {
    id: getId(source) ?? '',
    fullName: getFullName(source),
    username: typeof source.username === 'string' ? source.username : '',
    firstName: typeof source.firstName === 'string' ? source.firstName : '',
    lastName: typeof source.lastName === 'string' ? source.lastName : '',
    role: source.role as Role,
    status: source.status as UserStatus,
    isActive: Boolean(source.isActive),
    branchIds: Array.isArray(source.branchIds)
      ? source.branchIds.filter(
          (branchId): branchId is string => typeof branchId === 'string',
        )
      : [],
  };

  for (const key of [
    'telegramId',
    'email',
    'phoneNumber',
    'role',
    'createdAt',
    'updatedAt',
  ]) {
    const valueAtKey = source[key];
    if (valueAtKey !== undefined) {
      (mapped as PlainObject)[key] = valueAtKey;
    }
  }

  return mapped;
}

export function mapPublicResource<T = PlainObject>(value: unknown): T {
  const source = toPlain(value);

  if (Array.isArray(source)) {
    return source.map((item) => mapPublicResource(item)) as T;
  }

  if (!isPlainObject(source)) {
    return source as T;
  }

  const result: PlainObject = {};
  const id = getId(source);
  if (id) {
    result.id = id;
  }

  for (const [key, nestedValue] of Object.entries(source)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }

    if (USER_REFERENCE_KEYS.has(key)) {
      if (Array.isArray(nestedValue)) {
        result[key] = nestedValue
          .filter((item) => looksLikeUser(item))
          .map((item) => mapPublicUser(item));
      } else {
        if (!looksLikeUser(nestedValue)) {
          continue;
        }

        result[key] = mapPublicUser(nestedValue);
      }
      continue;
    }

    result[key] = mapPublicResource(nestedValue);
  }

  return result as T;
}

export function mapPublicResources<T = PlainObject>(values: unknown[]): T[] {
  return values.map((value) => mapPublicResource<T>(value));
}
