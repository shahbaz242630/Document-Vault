import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { OfflineCodeProtocolBundleV2 } from "./contracts";
import {
  normalizeOfflineCodeClientSecretV2,
  normalizeOfflineCodePublicLocatorV2,
} from "./material";
import { OFFLINE_CODE_V2_PROTOCOL_APPROVED } from "./protocol";
import {
  assertOfflineCodeClientSecretV2,
  assertOfflineCodeProtocolBundleV2,
  assertOfflineCodePublicLocatorV2,
} from "./validation";

const fixture = JSON.parse(readFileSync(fileURLToPath(
  new URL("../../../test-vectors/claim/offline-code-v2.json", import.meta.url),
), "utf8")) as {
  public_locator: unknown;
  synthetic_client_secret: unknown;
  protocol_bundle: OfflineCodeProtocolBundleV2;
};

describe("offline-code V2 protocol boundary", () => {
  it("keeps the protocol immutable-false and splits public locator from client secret", () => {
    expect(OFFLINE_CODE_V2_PROTOCOL_APPROVED).toBe(false);
    expect(assertOfflineCodePublicLocatorV2(fixture.public_locator)).toEqual(fixture.public_locator);
    expect(assertOfflineCodeClientSecretV2(fixture.synthetic_client_secret)).toEqual(fixture.synthetic_client_secret);
    expect(fixture.protocol_bundle).not.toHaveProperty("client_secret");
    expect(fixture.protocol_bundle).not.toHaveProperty("secret");
  });

  it("accepts only canonical checksummed material with the exact entropy lengths", () => {
    const locator = (fixture.public_locator as { locator: string }).locator;
    const secret = (fixture.synthetic_client_secret as { secret: string }).secret;
    expect(normalizeOfflineCodePublicLocatorV2(locator)).toHaveLength(26);
    expect(normalizeOfflineCodeClientSecretV2(secret)).toHaveLength(39);
    for (const mutation of [
      locator.replace("SK2-L-", "SK1-L-"),
      locator.toLowerCase(),
      locator.slice(0, -1) + (locator.endsWith("0") ? "1" : "0"),
      locator.replace("-", ""),
    ]) expect(() => normalizeOfflineCodePublicLocatorV2(mutation)).toThrow();
    for (const mutation of [
      secret.replace("SK2-S-", "SK1-S-"),
      "SK2-S-ABCD-0",
      secret.toLowerCase(),
      secret.slice(0, -2) + "A-0",
    ]) expect(() => normalizeOfflineCodeClientSecretV2(mutation)).toThrow();
  });

  it("rejects V1, locator-only authority, extra authority, and invalid challenge windows", () => {
    const cases: ((value: Record<string, unknown>) => void)[] = [
      (value) => { (value.challenge as Record<string, unknown>).protocol = "sanduqkin:claim:offline-code:v1"; },
      (value) => { (value.challenge as Record<string, unknown>).authority = "locator_only"; },
      (value) => { (value.possession_proof as Record<string, unknown>).authority = "release"; },
      (value) => { (value.challenge as Record<string, unknown>).expires_at = "2026-07-28T08:05:00.001Z"; },
      (value) => { (value.challenge as Record<string, unknown>).claimant_id = "70000000-0000-4000-8000-000000000008"; },
      (value) => { (value.kdf_profile as Record<string, unknown>).opslimit = 1; },
      (value) => { (value.kdf_profile as Record<string, unknown>).profile_id = "argon2id-synthetic-test-v1"; },
    ];
    for (const mutate of cases) {
      const candidate = structuredClone(fixture.protocol_bundle) as unknown as Record<string, unknown>;
      mutate(candidate);
      expect(() => assertOfflineCodeProtocolBundleV2(candidate)).toThrow();
    }
  });

  it("rejects cross-record, cross-version, cross-grant, cross-owner, KDF, and proof-key substitution", () => {
    const cases: ((value: Record<string, Record<string, unknown>>) => void)[] = [
      (value) => { value.possession_proof.locator_record_id = "50000000-0000-4000-8000-000000000015"; },
      (value) => { value.challenge.locator_version = 3; },
      (value) => { value.wrapped_mek.grant_id = "40000000-0000-4000-8000-000000000014"; },
      (value) => { value.wrapped_mek.owner_id = "10000000-0000-4000-8000-000000000011"; },
      (value) => { value.wrapped_mek.kdf_profile_id = "argon2id-synthetic-test-v3"; },
      (value) => { value.possession_proof.proof_key_version = 2; },
      (value) => { value.possession_proof.proof_public_key = "A".repeat(43); },
      (value) => { value.wrapped_mek.record_binding_digest = "A".repeat(43); },
    ];
    for (const mutate of cases) {
      const candidate = structuredClone(fixture.protocol_bundle) as unknown as Record<string, Record<string, unknown>>;
      mutate(candidate);
      expect(() => assertOfflineCodeProtocolBundleV2(candidate)).toThrow();
    }
  });
});
