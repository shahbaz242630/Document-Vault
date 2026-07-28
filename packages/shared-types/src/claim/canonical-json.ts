export type CanonicalJsonValue =
  | boolean
  | null
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export function canonicalJson(value: CanonicalJsonValue): string {
  return JSON.stringify(sortCanonicalValue(value));
}

export function canonicalJsonBytes(value: CanonicalJsonValue): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

function sortCanonicalValue(value: CanonicalJsonValue): CanonicalJsonValue {
  if (Array.isArray(value)) {
    return value.map(sortCanonicalValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortCanonicalValue(value[key])]),
    );
  }

  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error("Canonical claim JSON permits safe integers only.");
  }

  return value;
}
