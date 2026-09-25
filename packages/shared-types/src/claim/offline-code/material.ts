import {
  OFFLINE_CODE_V2_LOCATOR_BYTES,
  OFFLINE_CODE_V2_SECRET_BYTES,
} from "./protocol";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const checkAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";

export function normalizeOfflineCodePublicLocatorV2(value: unknown): string {
  return normalizeMaterial(value, "SK2-L-", OFFLINE_CODE_V2_LOCATOR_BYTES, "locator");
}
export function normalizeOfflineCodeClientSecretV2(value: unknown): string {
  return normalizeMaterial(value, "SK2-S-", OFFLINE_CODE_V2_SECRET_BYTES, "secret");
}

/** Formats fresh locator bytes as the printed `SK2-L-` value; the inverse of normalization. */
export function formatOfflineCodePublicLocatorV2(bytes: Uint8Array): string {
  return formatMaterial(bytes, "SK2-L-", OFFLINE_CODE_V2_LOCATOR_BYTES, "locator");
}
/** Formats fresh secret bytes as the printed `SK2-S-` value; the inverse of normalization. */
export function formatOfflineCodeClientSecretV2(bytes: Uint8Array): string {
  return formatMaterial(bytes, "SK2-S-", OFFLINE_CODE_V2_SECRET_BYTES, "secret");
}

function formatMaterial(bytes: Uint8Array, prefix: string, byteLength: number, label: string): string {
  if (!(bytes instanceof Uint8Array) || bytes.length !== byteLength) {
    throw new Error(`Offline-code V2 ${label} bytes are invalid.`);
  }
  let buffer = 0; let bits = 0; let payload = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; payload += alphabet[(buffer >>> bits) & 31]; buffer &= (1 << bits) - 1; }
  }
  if (bits > 0) payload += alphabet[(buffer << (5 - bits)) & 31];
  const groups = payload.match(/.{1,4}/gu) ?? [];
  return `${prefix}${groups.join("-")}-${checksum(payload)}`;
}

function normalizeMaterial(
  value: unknown,
  prefix: string,
  byteLength: number,
  label: string,
): string {
  if (typeof value !== "string" || !value.startsWith(prefix)) {
    throw new Error(`Offline-code V2 ${label} format is invalid.`);
  }
  const encoded = value.slice(prefix.length);
  const parts = encoded.split("-");
  const expectedPayloadLength = Math.ceil((byteLength * 8) / 5);
  const expectedGroups = Math.ceil(expectedPayloadLength / 4);
  if (parts.length !== expectedGroups + 1 ||
      parts.slice(0, -2).some((part) => part.length !== 4) ||
      parts.at(-2)?.length !== expectedPayloadLength - ((expectedGroups - 1) * 4) ||
      parts.at(-1)?.length !== 1) {
    throw new Error(`Offline-code V2 ${label} grouping is invalid.`);
  }
  const payload = parts.slice(0, -1).join("");
  if (payload.length !== expectedPayloadLength ||
      [...payload].some((character) => !alphabet.includes(character))) {
    throw new Error(`Offline-code V2 ${label} encoding is invalid.`);
  }
  if (parts.at(-1) !== checksum(payload)) {
    throw new Error(`Offline-code V2 ${label} checksum is invalid.`);
  }
  const unusedBits = (expectedPayloadLength * 5) - (byteLength * 8);
  if (unusedBits > 0 && (alphabet.indexOf(payload.at(-1) ?? "") & ((1 << unusedBits) - 1)) !== 0) {
    throw new Error(`Offline-code V2 ${label} encoding is non-canonical.`);
  }
  return payload;
}

function checksum(payload: string): string {
  let remainder = 0;
  for (const character of payload) {
    remainder = (remainder * 32 + alphabet.indexOf(character)) % checkAlphabet.length;
  }
  return checkAlphabet[remainder] ?? "";
}
