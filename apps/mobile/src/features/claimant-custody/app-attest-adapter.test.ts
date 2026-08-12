import { describe, expect, it, vi } from "vitest";

import {
  CLAIMANT_APP_ATTEST_ADAPTER_ENABLED,
  CLAIMANT_APP_ATTEST_MINIMUM_IOS_MAJOR_VERSION,
  createClaimantAppAttestProbe,
  type AppAttestNativeAdapter,
} from "./app-attest-adapter";

const challenge = "A".repeat(43);
const keyId = `${"A".repeat(42)}A=`;

describe("isolated claimant App Attest adapter", () => {
  it("remains hard-disabled and requires iOS 27", () => {
    expect(CLAIMANT_APP_ATTEST_ADAPTER_ENABLED).toBe(false);
    expect(CLAIMANT_APP_ATTEST_MINIMUM_IOS_MAJOR_VERSION).toBe(27);
  });

  it("passes opaque bytes unchanged through registration and assertion", async () => {
    const adapter = createAdapter();
    const probe = createClaimantAppAttestProbe(adapter);
    expect((await probe.register(challenge)).result_class).toBe("attestation_generated");
    expect((await probe.assert(challenge)).result_class).toBe("assertion_generated");
    expect(adapter.attestTestKeyAsync).toHaveBeenCalledWith(challenge);
    expect(adapter.generateTestAssertionAsync).toHaveBeenCalledWith(challenge);
  });

  it("fails before key generation when capability is unavailable", async () => {
    const adapter = createAdapter(result("ios_27_required", false));
    const outcome = await createClaimantAppAttestProbe(adapter).register(challenge);
    expect(outcome.result_class).toBe("ios_27_required");
    expect(adapter.ensureTestKeyAsync).not.toHaveBeenCalled();
  });

  it("rejects malformed challenges and unsafe native outputs", async () => {
    const adapter = createAdapter();
    await expect(createClaimantAppAttestProbe(adapter).register("not+base64url"))
      .rejects.toThrow("challenge bytes are invalid");
    adapter.attestTestKeyAsync = vi.fn(async () => ({
      ...result("attestation_generated", true),
      native_error: "prohibited",
    }) as never);
    await expect(createClaimantAppAttestProbe(adapter).register(challenge))
      .rejects.toThrow("non-allowlisted field");
  });
});

function createAdapter(capability = result("eligible", true)): AppAttestNativeAdapter & {
  [K in keyof AppAttestNativeAdapter]: ReturnType<typeof vi.fn>;
} {
  return {
    inspectCapabilityAsync: vi.fn(async () => capability),
    ensureTestKeyAsync: vi.fn(async () => ({ ...result("key_available", true), app_attest_key_id: keyId })),
    attestTestKeyAsync: vi.fn(async () => ({
      ...result("attestation_generated", true), app_attest_key_id: keyId,
      attestation_object: Buffer.alloc(32, 1).toString("base64"),
    })),
    generateTestAssertionAsync: vi.fn(async () => ({
      ...result("assertion_generated", true), app_attest_key_id: keyId,
      assertion_object: Buffer.alloc(32, 2).toString("base64"),
    })),
    clearTestKeyIdentifierAsync: vi.fn(async () => result("local_reference_cleared", true)),
  } as never;
}

function result(result_class: string, passed: boolean) {
  return { result_class, passed, protocol_profile: "app_attest_adapter_v1", test_alias_only: true } as const;
}
