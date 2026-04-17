type JsonRecord = Record<string, unknown>;

/** Runtime guard that narrows unknown JSON into an object record. */
export function expectRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as JsonRecord;
}

/** Reads a required string field from a JSON record. */
export function expectString(record: JsonRecord, key: string, label: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

/** Reads an optional string field from a JSON record. */
export function expectOptionalString(
  record: JsonRecord,
  key: string,
  label: string,
): string | undefined {
  if (!(key in record)) {
    return undefined;
  }

  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }

  return value;
}

/** Reads a nullable string field from a JSON record, defaulting missing fields to null. */
export function expectNullableString(
  record: JsonRecord,
  key: string,
  label: string,
): string | null {
  if (!(key in record)) {
    return null;
  }

  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }

  return value;
}

/** Reads an optional boolean field from a JSON record. */
export function expectOptionalBoolean(
  record: JsonRecord,
  key: string,
  label: string,
): boolean | undefined {
  if (!(key in record)) {
    return undefined;
  }

  const value = record[key];

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when provided.`);
  }

  return value;
}

/** Reads a required positive integer field from a JSON record. */
export function expectPositiveInteger(
  record: JsonRecord,
  key: string,
  label: string,
): number {
  const value = record[key];

  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return value as number;
}

/** Reads a required array of strings from a JSON record. */
export function expectStringArray(
  record: JsonRecord,
  key: string,
  label: string,
): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string") {
      throw new Error(`${label} entry ${index + 1} must be a string.`);
    }

    return entry;
  });
}

/** Reads a required array of object records from a JSON record. */
export function expectObjectArray(
  record: JsonRecord,
  key: string,
  label: string,
): JsonRecord[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((entry, index) =>
    expectRecord(entry, `${label} entry ${index + 1}`));
}
