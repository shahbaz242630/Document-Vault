import { canonicalJsonBytes } from "@vault/shared-types";
import sodium from "libsodium-wrappers-sumo";

export async function digestNativeEnrollmentRequestV1(value: unknown): Promise<string> {
  assertCompleteJson(value);
  await sodium.ready;
  return encodeBase64Url(sodium.crypto_hash_sha256(canonicalJsonBytes(value as never)));
}

function assertCompleteJson(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") { if (Number.isSafeInteger(value)) return; throw new Error("Request is not canonical JSON."); }
  if (typeof value !== "object" || seen.has(value)) throw new Error("Request is not canonical JSON.");
  seen.add(value);
  if (Array.isArray(value)) value.forEach((entry) => assertCompleteJson(entry, seen));
  else {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) throw new Error("Request is not canonical JSON.");
    Object.values(value).forEach((entry) => assertCompleteJson(entry, seen));
  }
  seen.delete(value);
}

function encodeBase64Url(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"; let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const block = ((value[index] ?? 0) << 16) | ((value[index + 1] ?? 0) << 8) | (value[index + 2] ?? 0);
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += alphabet[block & 63];
  }
  return output;
}
