import { appAttestSyntheticFixtureV1 as app, canonicalJsonBytes,
  nativeEnrollmentSyntheticFixtureV1 as fixture } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED,
  createEnrollmentAppAttestAdapterV1,
  createEnrollmentCustodyAdapterV1,
  type ClaimantEnrollmentNativeV1,
} from "./native-enrollment-adapters";

describe("claimant enrollment native lifecycle adapters", () => {
  it("is hard-disabled before touching the native module", async () => {
    expect(CLAIMANT_NATIVE_LIFECYCLE_ADAPTERS_APPROVED).toBe(false);
    const native = nativeModule();
    await expect(createEnrollmentAppAttestAdapterV1({ native }).ensureKey())
      .rejects.toMatchObject({ kind: "disabled" });
    await expect(createEnrollmentCustodyAdapterV1({ native }).createKey())
      .rejects.toMatchObject({ kind: "disabled" });
    expect(native.ensureAppAttestKeyAsync).not.toHaveBeenCalled();
    expect(native.createClaimantKeyAsync).not.toHaveBeenCalled();
  });

  it("fails safely when the production native module is unavailable", async () => {
    await expect(createEnrollmentAppAttestAdapterV1({ approved: true, native: null }).ensureKey())
      .rejects.toMatchObject({ kind: "failed", message: "Native enrollment operation could not be completed." });
    await expect(createEnrollmentCustodyAdapterV1({ approved: true, native: null }).createKey())
      .rejects.toMatchObject({ kind: "failed" });
  });

  it("maps only strict App Attest outputs and exact opaque challenge bytes", async () => {
    const native = nativeModule(); const adapter = createEnrollmentAppAttestAdapterV1({ approved: true, native });
    await expect(adapter.ensureKey()).resolves.toEqual({ appAttestKeyId: app.registration_response.app_attest_key_id });
    const registrationBytes = encoded(app.registration_challenge); const assertionBytes = encoded(app.assertion_challenge);
    await expect(adapter.createAttestation(registrationBytes)).resolves.toEqual({
      appAttestKeyId: app.registration_response.app_attest_key_id,
      attestationObject: app.registration_response.attestation_object });
    await expect(adapter.createAssertion(assertionBytes)).resolves.toEqual({
      appAttestKeyId: app.assertion_response.app_attest_key_id,
      assertionObject: app.assertion_response.assertion_object });
    expect(native.attestAppAttestKeyAsync).toHaveBeenCalledWith(registrationBytes);
  });

  it("creates, proves, and deletes only a production claimant alias", async () => {
    const native = nativeModule(); const adapter = createEnrollmentCustodyAdapterV1({ approved: true, native });
    const created = await adapter.createKey();
    expect(created).toEqual({ capability: fixture.challenge_request.capability,
      keyAliasReference: alias, publicKey: fixture.challenge_request.public_key });
    await expect(adapter.createPossessionProof({ challenge: fixture.challenge,
      challengeBytes: fixture.challenge_bytes, keyAliasReference: alias })).resolves.toEqual(fixture.possession_proof);
    await adapter.deleteKey(alias);
    expect(native.createClaimantPossessionProofAsync).toHaveBeenCalledWith(alias, fixture.challenge_bytes);
    expect(native.deleteClaimantKeyAsync).toHaveBeenCalledWith(alias);
  });

  it("rejects changed bindings, probe aliases, unexpected fields, and native error detail", async () => {
    const native = nativeModule();
    vi.mocked(native.createClaimantPossessionProofAsync).mockResolvedValueOnce({ ...fixture.possession_proof,
      invitation_reference: "59000000-0000-4000-8000-000000000099" });
    const custody = createEnrollmentCustodyAdapterV1({ approved: true, native });
    await expect(custody.createPossessionProof({ challenge: fixture.challenge,
      challengeBytes: fixture.challenge_bytes, keyAliasReference: alias }))
      .rejects.toMatchObject({ kind: "invalid_response", message: "Native enrollment operation could not be completed." });
    await expect(custody.deleteKey("com.sanduqkin.claimant-custody.probe-only.v3"))
      .rejects.toMatchObject({ kind: "invalid_response" });
    vi.mocked(native.ensureAppAttestKeyAsync).mockResolvedValueOnce({
      app_attest_key_id: app.registration_response.app_attest_key_id, native_error: "secret native detail" });
    await expect(createEnrollmentAppAttestAdapterV1({ approved: true, native }).ensureKey())
      .rejects.toMatchObject({ kind: "invalid_response", message: "Native enrollment operation could not be completed." });
  });
});

const alias = "claimant-enrollment.v1.91000000-0000-4000-8000-000000000019";
function nativeModule(): ClaimantEnrollmentNativeV1 & Record<string, ReturnType<typeof vi.fn>> {
  return {
    ensureAppAttestKeyAsync: vi.fn(async () => ({ app_attest_key_id: app.registration_response.app_attest_key_id })),
    attestAppAttestKeyAsync: vi.fn(async () => ({ app_attest_key_id: app.registration_response.app_attest_key_id,
      attestation_object: app.registration_response.attestation_object })),
    generateAppAttestAssertionAsync: vi.fn(async () => ({ app_attest_key_id: app.assertion_response.app_attest_key_id,
      assertion_object: app.assertion_response.assertion_object })),
    createClaimantKeyAsync: vi.fn(async () => ({ capability: fixture.challenge_request.capability,
      key_alias_reference: alias, public_key: fixture.challenge_request.public_key })),
    createClaimantPossessionProofAsync: vi.fn(async () => fixture.possession_proof),
    deleteClaimantKeyAsync: vi.fn(async () => ({ deleted: true })),
  };
}
function encoded(value: object): string { return Buffer.from(canonicalJsonBytes(value as never)).toString("base64url"); }
