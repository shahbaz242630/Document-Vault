import { appAttestSyntheticFixtureV1 as app, canonicalJsonBytes,
  nativeEnrollmentSyntheticFixtureV1 as fixture } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { NativeEnrollmentAttemptSecureStorageV1 } from "./native-enrollment-attempt-store";
import type { ClaimantEnrollmentNativeV1 } from "./native-enrollment-adapters";
import { CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED, createNativeEnrollmentRuntimeV1 } from "./native-enrollment-runtime";

describe("hard-disabled claimant native enrollment runtime", () => {
  it("does not touch native, auth, network, or storage while disabled", async () => {
    expect(CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED).toBe(false);
    const deps = dependencies(); const runtime = createNativeEnrollmentRuntimeV1(deps);
    await expect(runtime.enroll(fixture.challenge.invitation_reference)).rejects.toMatchObject({ kind: "disabled" });
    expect(deps.getAccessToken).not.toHaveBeenCalled(); expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.native.ensureAppAttestKeyAsync).not.toHaveBeenCalled(); expect(deps.storage.values.size).toBe(0);
  });

  it("composes exact native, encrypted persistence, transport, and terminal cleanup", async () => {
    const deps = dependencies(); const runtime = createNativeEnrollmentRuntimeV1({ ...deps, approved: true });
    await expect(runtime.enroll(fixture.challenge.invitation_reference)).resolves.toMatchObject({
      caseId: "61000000-0000-4000-8000-000000000016" });
    expect(deps.native.createClaimantKeyAsync).toHaveBeenCalledOnce();
    expect(deps.native.createClaimantPossessionProofAsync).toHaveBeenCalledWith(alias, fixture.challenge_bytes);
    expect(deps.storage.values.size).toBe(0);
  });

  it("aborts an in-flight operation and reconciles before session end", async () => {
    const deps = dependencies();
    vi.mocked(deps.fetch).mockImplementationOnce((_url, init) => new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error(), { name: "AbortError" })));
    }));
    const runtime = createNativeEnrollmentRuntimeV1({ ...deps, approved: true });
    const enrollment = runtime.enroll(fixture.challenge.invitation_reference);
    await vi.waitFor(() => expect(deps.fetch).toHaveBeenCalledOnce());
    const settled = runtime.settleBeforeSessionEnd();
    await expect(enrollment).rejects.toMatchObject({ kind: "aborted" });
    await expect(settled).resolves.toEqual({ status: "none" });
  });

  it("reconciles an ambiguous final submission before session teardown deletes custody", async () => {
    const deps = dependencies();
    vi.mocked(deps.fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.endsWith("/complete") && path.includes("/native-enrollment/challenges/")) {
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort",
          () => reject(Object.assign(new Error(), { name: "AbortError" }))));
      }
      if (path.includes("/attempts/")) return response({ result: { status: "not_committed" } });
      return responseForPath(path);
    });
    const runtime = createNativeEnrollmentRuntimeV1({ ...deps, approved: true });
    const enrollment = runtime.enroll(fixture.challenge.invitation_reference);
    await vi.waitFor(() => expect(deps.fetch).toHaveBeenCalledTimes(4));
    await expect(runtime.settleBeforeSessionEnd()).resolves.toEqual({ status: "cleaned" });
    await expect(enrollment).rejects.toMatchObject({ kind: "reconciliation_required" });
    expect(deps.native.deleteClaimantKeyAsync).toHaveBeenCalledWith(alias);
    expect(deps.storage.values.size).toBe(0);
  });

  it("rejects concurrent enrollment without starting a second native or HTTP flow", async () => {
    const deps = dependencies(); vi.mocked(deps.native.ensureAppAttestKeyAsync).mockImplementationOnce(() => new Promise(() => {}));
    const runtime = createNativeEnrollmentRuntimeV1({ ...deps, approved: true });
    void runtime.enroll(fixture.challenge.invitation_reference);
    await expect(runtime.enroll(fixture.challenge.invitation_reference)).rejects.toMatchObject({ kind: "busy" });
    expect(deps.native.ensureAppAttestKeyAsync).toHaveBeenCalledOnce();
  });
});

const alias = "claimant-enrollment.v1.91000000-0000-4000-8000-000000000019";
type FetchMockV1 = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
function dependencies() {
  const values = new Map<string, string>();
  const storage: NativeEnrollmentAttemptSecureStorageV1 & { values: Map<string, string> } = {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7, values,
    async deleteItemAsync(key) { values.delete(key); }, async getItemAsync(key) { return values.get(key) ?? null; },
    async setItemAsync(key, value) { values.set(key, value); } };
  const native: ClaimantEnrollmentNativeV1 & Record<string, ReturnType<typeof vi.fn>> = {
    ensureAppAttestKeyAsync: vi.fn(async () => ({ app_attest_key_id: app.registration_response.app_attest_key_id })),
    attestAppAttestKeyAsync: vi.fn(async () => ({ app_attest_key_id: app.registration_response.app_attest_key_id,
      attestation_object: app.registration_response.attestation_object })),
    generateAppAttestAssertionAsync: vi.fn(async () => ({ app_attest_key_id: app.assertion_response.app_attest_key_id,
      assertion_object: app.assertion_response.assertion_object })),
    createClaimantKeyAsync: vi.fn(async () => ({ capability: fixture.challenge_request.capability,
      key_alias_reference: alias, public_key: fixture.challenge_request.public_key })),
    createClaimantPossessionProofAsync: vi.fn(async () => fixture.possession_proof),
    deleteClaimantKeyAsync: vi.fn(async () => ({ deleted: true })) };
  const replies = [
    { result: { challenge: app.registration_challenge, challenge_bytes: encoded(app.registration_challenge) } },
    { result: { appAttestKeyRecordId: "81000000-0000-4000-8000-000000000018", assertionCounter: 0,
      challengeId: app.registration_challenge.challenge_id, replayed: false } },
    { result: { app_attest_challenge: assertionChallenge(),
      app_attest_challenge_bytes: encoded(assertionChallenge()), native_challenge: fixture.challenge,
      native_challenge_bytes: fixture.challenge_bytes } },
    { result: { assertionCounter: 1, caseId: "61000000-0000-4000-8000-000000000016", caseVersion: 1,
      claimantKeyId: fixture.challenge.claimant_key_id, invitationId: fixture.challenge.invitation_reference,
      invitationVersion: 1, replayed: false } },
  ];
  const fetchMock = vi.fn<FetchMockV1>(async () => response(replies.shift()));
  let id = 15; return { accountId: "21000000-0000-4000-8000-000000000002",
    apiBaseUrl: "https://api.synthetic.test", createIdempotencyKey: () => `91000000-0000-4000-8000-${String(++id).padStart(12, "0")}`,
    fetch: fetchMock, getAccessToken: vi.fn(async () => "synthetic-token"), native, storage };
}
function encoded(value: object): string { return Buffer.from(canonicalJsonBytes(value as never)).toString("base64url"); }
function assertionChallenge() { return { ...app.assertion_challenge, claimant_id: fixture.challenge.claimant_id,
  claimant_key_id: fixture.challenge.claimant_key_id, claimant_key_version: fixture.challenge.claimant_key_version,
  invitation_reference: fixture.challenge.invitation_reference, invitation_version: fixture.challenge.invitation_version,
  public_key_fingerprint: fixture.challenge.public_key_fingerprint }; }
function responseForPath(path: string): Response {
  if (path.endsWith("/app-attest/registration/challenges")) return response({ result: {
    challenge: app.registration_challenge, challenge_bytes: encoded(app.registration_challenge) } });
  if (path.includes("/app-attest/registration/challenges/")) return response({ result: {
    appAttestKeyRecordId: "81000000-0000-4000-8000-000000000018", assertionCounter: 0,
    challengeId: app.registration_challenge.challenge_id, replayed: false } });
  return response({ result: { app_attest_challenge: assertionChallenge(),
    app_attest_challenge_bytes: encoded(assertionChallenge()), native_challenge: fixture.challenge,
    native_challenge_bytes: fixture.challenge_bytes } });
}
function response(value: unknown): Response { return new Response(JSON.stringify(value), { status: 200,
  headers: { "content-type": "application/json" } }); }
