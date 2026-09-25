import { canonicalJson } from "../canonical-json";
import type {
  OfflineCodeClientSecretV2,
  OfflineCodeKdfProfileV2,
  OfflineCodePublicLocatorV2,
  OfflineCodeRecordBindingV2,
} from "./contracts";
import { OFFLINE_CODE_PROTOCOL_V2 } from "./protocol";
import {
  assertOfflineCodeClientSecretV2,
  assertOfflineCodeKdfProfileV2,
  assertOfflineCodePublicLocatorV2,
  assertOfflineCodeRecordBindingV2,
} from "./validation";

export const OFFLINE_CODE_V2_SHEET_PREFIX = "SKQ2." as const;
export const OFFLINE_CODE_V2_SHEET_MAX_LENGTH = 4096 as const;

/** Everything a claimant needs to prove possession, carried by the owner's printed emergency sheet (QR). */
export type OfflineCodeSheetV2 = Readonly<{
  publicLocator: OfflineCodePublicLocatorV2;
  clientSecret: OfflineCodeClientSecretV2;
  kdfProfile: OfflineCodeKdfProfileV2;
  recordBinding: OfflineCodeRecordBindingV2;
}>;

export class OfflineCodeSheetV2Error extends Error {
  constructor() {
    super("Offline-code emergency sheet is not recognised.");
    this.name = "OfflineCodeSheetV2Error";
  }
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const payloadPattern = /^[A-Za-z0-9_-]+$/u;
const sheetKeys = ["client_secret", "kdf_profile", "protocol", "public_locator", "purpose", "record_binding", "sheet_version"];

export function encodeOfflineCodeSheetV2(sheet: OfflineCodeSheetV2): string {
  const material = { protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "emergency_sheet", sheet_version: 1,
    public_locator: sheet.publicLocator, client_secret: sheet.clientSecret, kdf_profile: sheet.kdfProfile,
    record_binding: sheet.recordBinding };
  validate(material);
  return `${OFFLINE_CODE_V2_SHEET_PREFIX}${encodeBase64Url(new TextEncoder().encode(canonicalJson(material as never)))}`;
}

export function parseOfflineCodeSheetV2(text: unknown): OfflineCodeSheetV2 {
  try {
    if (typeof text !== "string" || text.length > OFFLINE_CODE_V2_SHEET_MAX_LENGTH
      || !text.startsWith(OFFLINE_CODE_V2_SHEET_PREFIX)) throw new Error();
    const payload = text.slice(OFFLINE_CODE_V2_SHEET_PREFIX.length);
    if (!payloadPattern.test(payload)) throw new Error();
    const json = new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(payload));
    const value: unknown = JSON.parse(json);
    const sheet = validate(value);
    if (canonicalJson(value as never) !== json) throw new Error();
    return sheet;
  } catch {
    throw new OfflineCodeSheetV2Error();
  }
}

function validate(value: unknown): OfflineCodeSheetV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OfflineCodeSheetV2Error();
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== sheetKeys.length || keys.some((key, index) => key !== sheetKeys[index])
    || record.protocol !== OFFLINE_CODE_PROTOCOL_V2 || record.purpose !== "emergency_sheet"
    || record.sheet_version !== 1) throw new OfflineCodeSheetV2Error();
  const kdfProfile = record.kdf_profile;
  assertOfflineCodeKdfProfileV2(kdfProfile);
  const sheet: OfflineCodeSheetV2 = Object.freeze({
    publicLocator: assertOfflineCodePublicLocatorV2(record.public_locator),
    clientSecret: assertOfflineCodeClientSecretV2(record.client_secret),
    kdfProfile,
    recordBinding: assertOfflineCodeRecordBindingV2(record.record_binding),
  });
  if (sheet.kdfProfile.profile_id !== sheet.recordBinding.kdf_profile_id) throw new OfflineCodeSheetV2Error();
  return sheet;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    const length = Math.min(3, bytes.length - index) + 1;
    for (let offset = 0; offset < length; offset += 1) output += alphabet[(chunk >> (18 - offset * 6)) & 63];
  }
  return output;
}

function decodeBase64Url(text: string): Uint8Array {
  if (text.length % 4 === 1) throw new Error();
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const group = text.slice(index, index + 4);
    let chunk = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      const digit = offset < group.length ? alphabet.indexOf(group[offset]) : 0;
      if (digit < 0) throw new Error();
      chunk = (chunk << 6) | digit;
    }
    const produced = group.length - 1;
    for (let offset = 0; offset < produced; offset += 1) bytes.push((chunk >> (16 - offset * 8)) & 255);
  }
  const decoded = Uint8Array.from(bytes);
  if (encodeBase64Url(decoded) !== text) throw new Error();
  return decoded;
}
