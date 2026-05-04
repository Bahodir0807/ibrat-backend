import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../../users/user-status.enum';

type PlainObject = Record<string, unknown>;
export type ApiResourceDto = { id?: string; [key: string]: any };

const SENSITIVE_KEYS = new Set([
  '__v',
  '_id',
  'password',
  'passwordChangedAt',
  'email',
  'phoneNumber',
  'accessToken',
  'refreshToken',
  'tokenHash',
  'token',
]);

const USER_REFERENCE_KEYS = new Set([
  'user',
  'student',
  'students',
  'teacher',
  'teacherId',
]);

export type PublicUserDto = {
  id: string;
  fullName: string;
  role?: Role;
  avatarUrl?: string;
  photoUrl?: string;
};

export type AdminUserDto = PublicUserDto & {
  username: string;
  telegramId?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
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
    return value.map(item => toPlain(item));
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
  const firstName = typeof source.firstName === 'string' ? source.firstName.trim() : '';
  const lastName = typeof source.lastName === 'string' ? source.lastName.trim() : '';
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

  return 'role' in value || 'username' in value || 'firstName' in value || 'lastName' in value;
}

export function mapPublicUser(value: unknown): PublicUserDto | string | unknown {
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

  if (typeof source.avatarUrl === 'string') {
    mapped.avatarUrl = source.avatarUrl;
  }

  if (typeof source.photoUrl === 'string') {
    mapped.photoUrl = source.photoUrl;
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
    role: source.role as Role,
    status: source.status as UserStatus,
    isActive: Boolean(source.isActive),
    branchIds: Array.isArray(source.branchIds) ? source.branchIds.filter((branchId): branchId is string => typeof branchId === 'string') : [],
  };

  for (const key of [
    'telegramId',
    'firstName',
    'lastName',
    'role',
    'avatarUrl',
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
    return source.map(item => mapPublicResource(item)) as T;
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
        result[key] = nestedValue.map(item => looksLikeUser(item) ? mapPublicUser(item) : mapPublicResource(item));
      } else {
        result[key] = looksLikeUser(nestedValue) ? mapPublicUser(nestedValue) : mapPublicResource(nestedValue);
      }
      continue;
    }

    result[key] = mapPublicResource(nestedValue);
  }

  return result as T;
}

export function mapPublicResources<T = PlainObject>(values: unknown[]): T[] {
  return values.map(value => mapPublicResource<T>(value));
}
