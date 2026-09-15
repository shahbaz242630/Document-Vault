import { describe, expect, it, vi } from "vitest";

import { createClaimantNativeSigningBoundary } from "./native-signing-boundary";

const id = (n: number) => `82000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const keyAlias = "claimant-handoff.test.v1.synthetic_key_001";
const keyFingerprint = "B".repeat(43);
const signature = "A".repeat(86);
const request = { transcriptBytesBase64url: "A".repeat(128), challengeId: id(1),
  recordBindingDigest: "A".repeat(43), signal: new AbortController().signal };
const result = { synthetic_only: true, status: "signed", signature, key_alias_reference: keyAlias,
  key_fingerprint: keyFingerprint, user_presence: "verified", private_key_exportable: false } as const;

function harness(nativeResult: unknown = result) {
  const signClaimantHandoffAsync = vi.fn(async () => nativeResult);
  const boundary = createClaimantNativeSigningBoundary({ approved: true, syntheticOnly: true,
    productionRuntime: false, keyAliasReference: keyAlias, keyFingerprint,
    native: { syntheticOnly: true, signClaimantHandoffAsync } });
  return { boundary, signClaimantHandoffAsync };
}

describe("claimant native handoff signing boundary", () => {
  it("is dormant by default without touching native dependencies", async () => {
    const touched = vi.fn(() => { throw new Error("native detail"); });
    const boundary = createClaimantNativeSigningBoundary(Object.defineProperties({}, Object.fromEntries([
      "syntheticOnly", "productionRuntime", "keyAliasReference", "keyFingerprint", "native"
    ].map((key) => [key, { get: touched }]))) as never);
    await expect(boundary.signer.sign(request)).rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
    expect(boundary.snapshot().status).toBe("disabled"); expect(touched).not.toHaveBeenCalled();
  });

  it("signs exact transcript bindings under an injected test alias", async () => {
    const h = harness(); await expect(h.boundary.signer.sign(request)).resolves.toBe(signature);
    expect(h.signClaimantHandoffAsync).toHaveBeenCalledWith({
      transcript_bytes_base64url: request.transcriptBytesBase64url, challenge_id: request.challengeId,
      record_binding_digest: request.recordBindingDigest, key_alias_reference: keyAlias,
      signal: expect.any(AbortSignal) });
    expect(h.boundary.snapshot().status).toBe("ready"); await h.boundary.dispose();
  });

  it.each([
    { ...result, key_alias_reference: "claimant-handoff.test.v1.other_key" },
    { ...result, key_fingerprint: "C".repeat(43) }, { ...result, user_presence: "missing" },
    { ...result, private_key_exportable: true }, { ...result, private_key: "forbidden" },
    { ...result, signature: "bad" },
  ])("rejects substituted, expanded or unsafe native results", async (nativeResult) => {
    const h = harness(nativeResult);
    await expect(h.boundary.signer.sign(request)).rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
  });

  it("rejects malformed requests before native work", async () => {
    const h = harness();
    await expect(h.boundary.signer.sign({ ...request, recordBindingDigest: "bad" }))
      .rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
    expect(h.signClaimantHandoffAsync).not.toHaveBeenCalled();
  });

  it("serializes work and suppresses a late result after cancellation", async () => {
    let finish!: (value: unknown) => void; const signClaimantHandoffAsync = vi.fn(() =>
      new Promise<unknown>((resolve) => { finish = resolve; }));
    const boundary = createClaimantNativeSigningBoundary({ approved: true, syntheticOnly: true,
      productionRuntime: false, keyAliasReference: keyAlias, keyFingerprint,
      native: { syntheticOnly: true, signClaimantHandoffAsync } });
    const controller = new AbortController(); const pending = boundary.signer.sign({ ...request, signal: controller.signal });
    await vi.waitFor(() => expect(signClaimantHandoffAsync).toHaveBeenCalledOnce());
    await expect(boundary.signer.sign(request)).rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
    controller.abort(); finish(result);
    await expect(pending).rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
    expect(boundary.snapshot().status).toBe("ready");
  });

  it("disposes awaitably and aborts in-flight native signing", async () => {
    let observedSignal!: AbortSignal; const native = { syntheticOnly: true as const,
      signClaimantHandoffAsync: vi.fn((value: { signal: AbortSignal }) => {
        observedSignal = value.signal; return new Promise<unknown>(() => undefined);
      }) };
    const boundary = createClaimantNativeSigningBoundary({ approved: true, syntheticOnly: true,
      productionRuntime: false, keyAliasReference: keyAlias, keyFingerprint, native });
    const pending = boundary.signer.sign(request);
    await vi.waitFor(() => expect(native.signClaimantHandoffAsync).toHaveBeenCalledOnce());
    await boundary.dispose(); expect(observedSignal.aborted).toBe(true);
    await expect(pending).rejects.toHaveProperty("name", "ClaimantNativeSigningUnavailableError");
    expect(boundary.snapshot().status).toBe("closed");
  });
});
