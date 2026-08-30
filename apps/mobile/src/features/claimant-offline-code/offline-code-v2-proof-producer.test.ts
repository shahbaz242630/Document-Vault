import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  OfflineCodeChallengeV2,
  OfflineCodeClientSecretV2,
  OfflineCodeKdfProfileV2,
  OfflineCodePublicLocatorV2,
  OfflineCodeRecordBindingV2,
} from "@vault/shared-types";
import { describe, expect, it } from "vitest";

import { OfflineCodeV2ClientProofError } from "./offline-code-v2-proof-core";
import { createOfflineCodeV2PlatformProofProducer } from "./offline-code-v2-proof-producer";

type Vector = Readonly<{
  public_locator: OfflineCodePublicLocatorV2;
  synthetic_client_secret: OfflineCodeClientSecretV2;
  kdf_profile: OfflineCodeKdfProfileV2;
  record_binding: OfflineCodeRecordBindingV2;
  challenge: OfflineCodeChallengeV2;
  possession_proof: unknown;
}>;

describe("offline-code V2 client proof producer", () => {
  it("is literal-false by default and exposes one safe error", async () => {
    const producer = createOfflineCodeV2PlatformProofProducer();
    await expect(producer.produce(proofInput(vector()))).rejects.toMatchObject({
      kind: "disabled",
      message: "Offline-code proof production is unavailable.",
    });
  });

  it("reproduces the frozen Argon2id/HKDF/Ed25519 possession proof", async () => {
    const fixture = vector();
    const proof = await createOfflineCodeV2PlatformProofProducer(true).produce(proofInput(fixture));
    expect(proof).toEqual(fixture.possession_proof);
    expect(proof.authority).toBe("route_possession_only");
    expect(proof).not.toHaveProperty("identity");
    expect(proof).not.toHaveProperty("grant_id");
  });

  it("rejects origin, expiry, locator, record, proof-key, and challenge substitutions", async () => {
    const fixture = vector();
    const producer = createOfflineCodeV2PlatformProofProducer(true);
    const hostile = [
      { ...proofInput(fixture), expectedOrigin: "https://evil.example" },
      { ...proofInput(fixture), now: () => new Date(fixture.challenge.expires_at) },
      { ...proofInput(fixture), publicLocator: { ...fixture.public_locator,
        locator: validAlternative(fixture.public_locator.locator) } },
      { ...proofInput(fixture), clientSecret: { ...fixture.synthetic_client_secret,
        secret: validAlternative(fixture.synthetic_client_secret.secret) } },
      { ...proofInput(fixture), recordBinding: { ...fixture.record_binding,
        grant_id: "40000000-0000-4000-8000-000000000099" } },
      { ...proofInput(fixture), challenge: { ...fixture.challenge,
        proof_key_version: fixture.challenge.proof_key_version + 1 } },
    ];
    for (const input of hostile) {
      await expect(producer.produce(input)).rejects.toEqual(
        new OfflineCodeV2ClientProofError("failed"),
      );
    }
  });

  it("runs a bounded synthetic benchmark without approving a KDF profile", async () => {
    const fixture = vector();
    const report = await createOfflineCodeV2PlatformProofProducer(true).benchmark({
      publicLocator: fixture.public_locator,
      clientSecret: fixture.synthetic_client_secret,
      kdfProfile: fixture.kdf_profile,
      recordBinding: fixture.record_binding,
      sampleCount: 1,
      device: {
        platform: "desktop_reference",
        evidenceClass: "desktop_reference",
        model: "CI desktop reference",
        osVersion: "test",
        cryptoRuntime: "libsodium-wasm",
      },
    });
    expect(report).toMatchObject({
      purpose: "synthetic_kdf_benchmark",
      synthetic_only: true,
      production_approved: false,
      representative_device: false,
      sample_count: 1,
    });
    expect(report.durations_ms[0]).toBeGreaterThan(0);
  });
});

function vector(): Vector {
  return JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as Vector;
}
function proofInput(value: Vector) {
  return {
    publicLocator: value.public_locator,
    clientSecret: value.synthetic_client_secret,
    kdfProfile: value.kdf_profile,
    recordBinding: value.record_binding,
    challenge: value.challenge,
    expectedOrigin: value.challenge.origin,
    now: () => new Date(Date.parse(value.challenge.issued_at) + 1_000),
  };
}
function validAlternative(value: string): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const checks = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";
  const parts = value.split("-");
  const payload = parts.slice(2, -1).join("");
  const replacement = `${payload.slice(0, -2)}${payload.at(-2) === "0" ? "1" : "0"}${payload.at(-1)}`;
  let remainder = 0;
  for (const character of replacement) remainder = (remainder * 32 + alphabet.indexOf(character)) % checks.length;
  const groups = replacement.match(/.{1,4}/gu) ?? [];
  return `${parts[0]}-${parts[1]}-${groups.join("-")}-${checks[remainder]}`;
}
