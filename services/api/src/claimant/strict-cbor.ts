type CborScalar = Uint8Array | string | number | boolean | null;
export type CborValue = CborScalar | readonly CborValue[] | ReadonlyMap<CborKey, CborValue>;
export type CborKey = string | number;

const MAX_CBOR_BYTES = 131_072;
const MAX_DEPTH = 12;
const MAX_COLLECTION_ENTRIES = 64;

export function decodeStrictCbor(value: Uint8Array): CborValue {
  if (value.byteLength === 0 || value.byteLength > MAX_CBOR_BYTES) fail();
  const decoded = decodeAt(value, 0, 0);
  if (decoded.offset !== value.byteLength) fail();
  return decoded.value;
}

export function decodeStrictCborPrefix(
  value: Uint8Array,
  offset: number,
): Readonly<{ offset: number; value: CborValue }> {
  if (value.byteLength === 0 || value.byteLength > MAX_CBOR_BYTES) fail();
  return decodeAt(value, offset, 0);
}

function decodeAt(
  source: Uint8Array,
  offset: number,
  depth: number,
): Readonly<{ offset: number; value: CborValue }> {
  if (depth > MAX_DEPTH || offset >= source.byteLength) fail();
  const initial = source[offset] as number;
  const major = initial >>> 5;
  const additional = initial & 0x1f;
  if (additional === 31) fail();
  const length = readArgument(source, offset + 1, additional);
  let cursor = length.offset;

  if (major === 0) return { offset: cursor, value: toSafeNumber(length.value) };
  if (major === 1) return { offset: cursor, value: -1 - toSafeNumber(length.value) };
  if (major === 2 || major === 3) {
    const size = toSafeNumber(length.value);
    if (size > MAX_CBOR_BYTES || cursor + size > source.byteLength) fail();
    const bytes = source.slice(cursor, cursor + size);
    cursor += size;
    if (major === 2) return { offset: cursor, value: bytes };
    try {
      return { offset: cursor, value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch { fail(); }
  }
  if (major === 4) {
    const count = toSafeNumber(length.value);
    if (count > MAX_COLLECTION_ENTRIES) fail();
    const items: CborValue[] = [];
    for (let index = 0; index < count; index += 1) {
      const item = decodeAt(source, cursor, depth + 1);
      cursor = item.offset;
      items.push(item.value);
    }
    return { offset: cursor, value: items };
  }
  if (major === 5) {
    const count = toSafeNumber(length.value);
    if (count > MAX_COLLECTION_ENTRIES) fail();
    const entries = new Map<CborKey, CborValue>();
    for (let index = 0; index < count; index += 1) {
      const keyResult = decodeAt(source, cursor, depth + 1);
      cursor = keyResult.offset;
      if (typeof keyResult.value !== "string" && typeof keyResult.value !== "number") fail();
      if (entries.has(keyResult.value)) fail();
      const item = decodeAt(source, cursor, depth + 1);
      cursor = item.offset;
      entries.set(keyResult.value, item.value);
    }
    return { offset: cursor, value: entries };
  }
  if (major === 7 && additional >= 20 && additional <= 22) {
    return { offset: offset + 1, value: additional === 20 ? false : additional === 21 ? true : null };
  }
  fail();
}

function readArgument(
  source: Uint8Array,
  offset: number,
  additional: number,
): Readonly<{ offset: number; value: bigint }> {
  if (additional < 24) return { offset, value: BigInt(additional) };
  const byteLength = additional === 24 ? 1 : additional === 25 ? 2 : additional === 26 ? 4 : additional === 27 ? 8 : 0;
  if (byteLength === 0 || offset + byteLength > source.byteLength) fail();
  let value = 0n;
  for (let index = 0; index < byteLength; index += 1) value = (value << 8n) | BigInt(source[offset + index] as number);
  if ((byteLength === 1 && value < 24n) || (byteLength === 2 && value <= 0xffn) ||
      (byteLength === 4 && value <= 0xffffn) || (byteLength === 8 && value <= 0xffffffffn)) fail();
  return { offset: offset + byteLength, value };
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail();
  return Number(value);
}

function fail(): never {
  throw new Error("App Attest CBOR is invalid.");
}
