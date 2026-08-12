import { createECDH } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { createAppAttestRegistrationChallengeMaterialV1, createNativeEnrollmentChallengeMaterialV1 } from "./native-enrollment-challenge-factory.js";

const vector = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json", import.meta.url,
)), "utf8")) as { challenge_request: { public_key: string }; synthetic_key_material: { server_ephemeral_private_scalar: string } };
const uuids = ["71000000-0000-4000-8000-000000000001", "71000000-0000-4000-8000-000000000002", "31000000-0000-4000-8000-000000000013"];
const app = { appAttestKeyIdDigest: "A".repeat(42) + "E", appIdHash: "B".repeat(42) + "E",
  environment: "production" as const, requiredBundleVersion: "1", requiredValidationCategory: 2 as const };

describe("native enrollment challenge factory", () => {
  it("creates an exact five-minute opaque App Attest registration challenge", () => {
    const result = createAppAttestRegistrationChallengeMaterialV1({ ...app,
      apiAudience: "https://api.sanduqkin.test", claimantUserId: "21000000-0000-4000-8000-000000000002",
      portalSessionId: "81000000-0000-4000-8000-000000000018",
    }, { now: () => new Date("2026-08-12T12:00:00.000Z"), random32: () => Buffer.alloc(32, 1), randomUuid: () => uuids[0]! });
    expect(result.challenge).toMatchObject({ challenge_id: uuids[0], expires_at: "2026-08-12T12:05:00.000Z" });
    expect(result.challengeBytesDigest).toHaveLength(43);
  });

  it("generates mutually bound native/App Attest challenges and seals the ephemeral scalar", () => {
    const scalar = Buffer.from(vector.synthetic_key_material.server_ephemeral_private_scalar, "base64url");
    const ecdh = createECDH("prime256v1"); ecdh.setPrivateKey(scalar);
    const seal = vi.fn(() => "v1.synthetic.envelope.material"); let uuidIndex = 0;
    const result = createNativeEnrollmentChallengeMaterialV1({ ...app,
      apiAudience: "https://api.sanduqkin.test", claimantPublicKeyBase64Url: vector.challenge_request.public_key,
      claimantUserId: "21000000-0000-4000-8000-000000000002", custody: { open: vi.fn(), seal },
      deviceBindingDigest: "d".repeat(64), eligibilityVersion: 1,
      invitationId: "51000000-0000-4000-8000-000000000005", invitationVersion: 1,
      policyPackId: "death-only-v1", policyPackVersion: 1,
      portalSessionId: "81000000-0000-4000-8000-000000000018",
    }, { generateEphemeralKey: () => ({ privateKey: Buffer.from(scalar), publicKey: ecdh.getPublicKey() }),
      now: () => new Date("2026-08-12T12:00:00.000Z"), random32: () => Buffer.alloc(32, 2),
      randomUuid: () => uuids[uuidIndex++]! });
    expect(result.appAttestChallenge.native_enrollment_challenge_digest).toBe(result.nativeChallengeBytesDigest);
    expect(result.appAttestChallenge.claimant_key_id).toBe(result.claimantKeyId);
    expect(result.nativeChallenge.claimant_key_id).toBe(result.claimantKeyId);
    expect(result).not.toHaveProperty("serverEphemeralPrivateKey");
    expect(seal).toHaveBeenCalledOnce();
  });
});
