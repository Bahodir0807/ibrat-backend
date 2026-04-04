type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPlain(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => toPlain(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if (typeof (value as { toObject?: () => unknown }).toObject === 'function') {
    return toPlain((value as { toObject: () => unknown }).toObject());
  }

  const source = value as PlainObject;
  const result: PlainObject = {};

  if (source._id != null) {
    const id = String(source._id);
    result.id = id;
    result._id = id;
  }

  for (const [key, nestedValue] of Object.entries(source)) {
    if (key === '__v' || key === '_id') {
      continue;
    }

    result[key] = toPlain(nestedValue);
  }

  return result;
}

export function serializeResource<T>(value: T): T {
  return toPlain(value) as T;
}

export function serializeResources<T>(value: T[]): T[] {
  return value.map(item => serializeResource(item));
}
