import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canonicalJson } from "../canonical-json";
import {
  encodeOfflineCodeSheetV2,
  OFFLINE_CODE_V2_SHEET_PREFIX,
  OfflineCodeSheetV2Error,
  parseOfflineCodeSheetV2,
  type OfflineCodeSheetV2,
} from "./sheet";

const vector = JSON.parse(readFileSync(resolve(__dirname, "../../../test-vectors/claim/offline-code-v2.json"), "utf8"));
const sheet: OfflineCodeSheetV2 = { publicLocator: vector.public_locator, clientSecret: vector.synthetic_client_secret,
  kdfProfile: vector.kdf_profile, recordBinding: vector.record_binding };
const material = () => structuredClone({ protocol: "sanduqkin:claim:offline-code:v2", purpose: "emergency_sheet",
  sheet_version: 1, public_locator: vector.public_locator, client_secret: vector.synthetic_client_secret,
  kdf_profile: vector.kdf_profile, record_binding: vector.record_binding }) as Record<string, any>;
const wrap = (json: string) => `${OFFLINE_CODE_V2_SHEET_PREFIX}${Buffer.from(json, "utf8").toString("base64url")}`;
const generic = { name: "OfflineCodeSheetV2Error", message: "Offline-code emergency sheet is not recognised." };

describe("offline-code V2 emergency sheet payload", () => {
  it("round-trips the synthetic fixture into exactly the proof material", () => {
    const encoded = encodeOfflineCodeSheetV2(sheet);
    expect(encoded.startsWith("SKQ2.")).toBe(true);
    expect(encoded).toBe(wrap(canonicalJson(material() as never)));
    const parsed = parseOfflineCodeSheetV2(encoded);
    expect(parsed).toEqual(sheet);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    ["non-string input", 42],
    ["another prefix", `SKQ3.${encodeOfflineCodeSheetV2(sheet).slice(5)}`],
    ["leading whitespace", ` ${encodeOfflineCodeSheetV2(sheet)}`],
    ["trailing newline", `${encodeOfflineCodeSheetV2(sheet)}\n`],
    ["standard base64 padding", `${encodeOfflineCodeSheetV2(sheet)}=`],
    ["truncated payload", encodeOfflineCodeSheetV2(sheet).slice(0, -3)],
    ["oversize input", `SKQ2.${"A".repeat(5000)}`],
    ["non-canonical JSON", wrap(JSON.stringify(material()))],
    ["invalid UTF-8", `SKQ2.${Buffer.from([0xff, 0xfe, 0xfd]).toString("base64url")}`],
  ])("rejects %s with one generic error", (_label, input) => {
    expect(() => parseOfflineCodeSheetV2(input)).toThrow(OfflineCodeSheetV2Error);
    try { parseOfflineCodeSheetV2(input); } catch (error) {
      expect(error).toMatchObject(generic);
      expect(String((error as Error).message)).not.toContain(vector.synthetic_client_secret.secret);
    }
  });

  it.each([
    ["an unknown field", (value: Record<string, any>) => { value.owner_note = "extra"; }],
    ["a missing binding", (value: Record<string, any>) => { delete value.record_binding; }],
    ["a different purpose", (value: Record<string, any>) => { value.purpose = "challenge"; }],
    ["a future sheet version", (value: Record<string, any>) => { value.sheet_version = 2; }],
    ["a corrupted secret checksum", (value: Record<string, any>) => {
      value.client_secret.secret = value.client_secret.secret.replace(/.(=?)$/u, (last: string, pad: string) =>
        `${last[0] === "0" ? "1" : "0"}${pad}`); }],
    ["a production-approved KDF profile", (value: Record<string, any>) => { value.kdf_profile.production_approved = true; }],
    ["a KDF profile that differs from the binding", (value: Record<string, any>) => {
      value.record_binding.kdf_profile_id = "argon2id-other-profile"; }],
    ["an owner id that is not a UUID", (value: Record<string, any>) => { value.record_binding.owner_id = "owner"; }],
  ])("rejects a canonical sheet with %s", (_label, mutate) => {
    const value = material(); mutate(value);
    expect(() => parseOfflineCodeSheetV2(wrap(canonicalJson(value as never)))).toThrow(OfflineCodeSheetV2Error);
  });

  it("refuses to encode invalid material", () => {
    expect(() => encodeOfflineCodeSheetV2({ ...sheet, recordBinding: { ...sheet.recordBinding,
      kdf_profile_id: "argon2id-other-profile" } })).toThrow();
  });
});

describe("offline-code V2 handover value formatting", () => {
  it("reproduces the printed fixture locator and secret from their bytes", async () => {
    const { formatOfflineCodeClientSecretV2, formatOfflineCodePublicLocatorV2 } = await import("./material");
    const range = (start: number, length: number) => Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);
    expect(formatOfflineCodePublicLocatorV2(range(161, 16))).toBe(vector.public_locator.locator);
    expect(formatOfflineCodeClientSecretV2(range(177, 24))).toBe(vector.synthetic_client_secret.secret);
    expect(() => formatOfflineCodePublicLocatorV2(new Uint8Array(15))).toThrow();
  });
});
