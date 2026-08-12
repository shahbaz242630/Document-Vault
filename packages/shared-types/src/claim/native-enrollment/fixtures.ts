import type { NativeEnrollmentSyntheticFixtureV1 } from "./contracts";
import { canonicalJsonBytes } from "../canonical-json";

const syntheticChallenge = {
  challenge_id: "22222222-2222-4222-8222-222222222222",
  claimant_id: "44444444-4444-4444-8444-444444444444",
  claimant_key_id: "33333333-3333-4333-8333-333333333333",
  claimant_key_version: 1,
  device_binding_digest: "11".repeat(32),
  eligibility_version: 1,
  expires_at: "2030-01-01T00:05:00.000Z",
  invitation_reference: "11111111-1111-4111-8111-111111111111",
  invitation_version: 1,
  issued_at: "2030-01-01T00:00:00.000Z",
  kdf_salt: `${"S".repeat(42)}Q`,
  nonce: `${"N".repeat(42)}Q`,
  origin: "https://api.synthetic.test",
  policy_pack_id: "synthetic-death-only-v1",
  policy_pack_version: 1,
  protocol: "sanduqkin:claim:native-enrollment:v1",
  public_key_fingerprint: `${"F".repeat(42)}Q`,
  server_ephemeral_public_key: `B${"C".repeat(85)}A`,
} as const;

export const nativeEnrollmentSyntheticFixtureV1: NativeEnrollmentSyntheticFixtureV1 = {
  challenge_request: {
    capability: {
      claimed_hardware_security_level: "secure_enclave",
      key_algorithm: "p256_ecdh",
      platform: "ios",
      claimed_private_key_exportable: false,
      protocol: "sanduqkin:claim:native-enrollment:v1",
      public_key_encoding: "ansi_x9_63_uncompressed",
      claimed_user_presence_binding: "transaction_bound",
    },
    invitation_reference: "11111111-1111-4111-8111-111111111111",
    policy_pack_id: "synthetic-death-only-v1",
    policy_pack_version: 1,
    protocol: "sanduqkin:claim:native-enrollment:v1",
    public_key: `B${"A".repeat(86)}`,
  },
  challenge: syntheticChallenge,
  challenge_bytes: encodeBase64Url(canonicalJsonBytes(syntheticChallenge)),
  possession_proof: {
    challenge_id: "22222222-2222-4222-8222-222222222222",
    claimant_id: "44444444-4444-4444-8444-444444444444",
    claimant_key_id: "33333333-3333-4333-8333-333333333333",
    claimant_key_version: 1,
    device_binding_digest: "11".repeat(32),
    invitation_reference: "11111111-1111-4111-8111-111111111111",
    proof_mac: `${"P".repeat(42)}Q`,
    protocol: "sanduqkin:claim:native-enrollment:v1",
    public_key_fingerprint: `${"F".repeat(42)}Q`,
  },
};

function encodeBase64Url(value: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const block = ((value[index] ?? 0) << 16) | ((value[index + 1] ?? 0) << 8) | (value[index + 2] ?? 0);
    output += alphabet[(block >>> 18) & 63] + alphabet[(block >>> 12) & 63];
    if (index + 1 < value.length) output += alphabet[(block >>> 6) & 63];
    if (index + 2 < value.length) output += alphabet[block & 63];
  }
  return output;
}
