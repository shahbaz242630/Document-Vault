import { appAttestSyntheticFixtureV1 as app, canonicalJsonBytes,
  nativeEnrollmentSyntheticFixtureV1 as native } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";
import { createNativeEnrollmentTransportV1, NativeEnrollmentTransportError } from "./native-enrollment-transport";

const idempotencyKey = "91000000-0000-4000-8000-000000000019";

describe("native enrollment mobile transport", () => {
  it("sends only the strict authenticated registration request and validates canonical response bytes", async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => response({ result: {
      challenge: app.registration_challenge, challenge_bytes: encoded(app.registration_challenge) } }));
    const transport = createNativeEnrollmentTransportV1({ apiBaseUrl: "https://api.sanduqkin.test", fetch,
      getAccessToken: async () => "signed-token" });
    const result = await transport.issueRegistration({ appAttestKeyId: app.registration_response.app_attest_key_id, idempotencyKey });
    expect(result.challenge).toEqual(app.registration_challenge);
    const [url, init] = fetch.mock.calls[0]!; expect(url).toBe("https://api.sanduqkin.test/claimant/native-enrollment/app-attest/registration/challenges");
    expect(init).toEqual(expect.objectContaining({ cache: "no-store", credentials: "omit", method: "POST", redirect: "error" }));
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer signed-token", "Idempotency-Key": idempotencyKey }));
    expect(JSON.parse(String(init?.body))).toEqual({ app_attest_key_id: app.registration_response.app_attest_key_id });
  });

  it("validates paired native/App Attest bindings and sends no client policy authority", async () => {
    const assertion = pairedAssertion();
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response({ result: { app_attest_challenge: assertion,
      app_attest_challenge_bytes: encoded(assertion), native_challenge: native.challenge,
      native_challenge_bytes: native.challenge_bytes } }));
    const transport = createNativeEnrollmentTransportV1({ apiBaseUrl: "https://api.sanduqkin.test", fetch,
      getAccessToken: async () => "token" });
    const request = { capability: native.challenge_request.capability,
      invitation_reference: native.challenge_request.invitation_reference,
      protocol: native.challenge_request.protocol, public_key: native.challenge_request.public_key };
    await transport.issueNative({ appAttestKeyId: app.registration_response.app_attest_key_id,
      idempotencyKey, request });
    const sent = JSON.parse(String(fetch.mock.calls[0]![1]?.body)) as Record<string, unknown>;
    expect(sent).not.toHaveProperty("policy_pack_id"); expect(sent).not.toHaveProperty("claimant_id");
    expect(sent).not.toHaveProperty("eligibility_version");

    const changed = { ...assertion, claimant_id: "99000000-0000-4000-8000-000000000099" };
    const hostile = createNativeEnrollmentTransportV1({ apiBaseUrl: "https://api.sanduqkin.test",
      fetch: async () => response({ result: { app_attest_challenge: changed,
        app_attest_challenge_bytes: encoded(changed), native_challenge: native.challenge,
        native_challenge_bytes: native.challenge_bytes } }), getAccessToken: async () => "token" });
    await expect(hostile.issueNative({ appAttestKeyId: app.registration_response.app_attest_key_id,
      idempotencyKey, request })).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("rejects noncanonical, oversized, malformed, unauthenticated, and redirected/error responses safely", async () => {
    const call = (fetch: typeof globalThis.fetch, token: string | null = "token") =>
      createNativeEnrollmentTransportV1({ apiBaseUrl: "https://api.sanduqkin.test", fetch,
        getAccessToken: async () => token }).issueRegistration({
          appAttestKeyId: app.registration_response.app_attest_key_id, idempotencyKey });
    await expect(call(async () => response({ result: { challenge: app.registration_challenge,
      challenge_bytes: `${encoded(app.registration_challenge)}A` } }))).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(call(async () => new Response("A".repeat(200_001)))).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(call(async () => new Response("not-json"))).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(call(async () => response({}, 429))).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(call(async () => response({}, 401))).rejects.toMatchObject({ kind: "authentication" });
    await expect(call(async () => { throw new TypeError("redirect blocked"); })).rejects.toMatchObject({ kind: "unavailable" });
    await expect(call(async () => response({}), null)).rejects.toBeInstanceOf(NativeEnrollmentTransportError);
  });

  it("fails before fetching for invalid origins, idempotency, cancellation, or token formatting", async () => {
    expect(() => createNativeEnrollmentTransportV1({ apiBaseUrl: "http://api.test", getAccessToken: async () => "x" }))
      .toThrow("API origin is invalid");
    const fetch = vi.fn(); const transport = createNativeEnrollmentTransportV1({ apiBaseUrl: "https://api.test", fetch,
      getAccessToken: async () => "bad token" });
    await expect(transport.issueRegistration({ appAttestKeyId: app.registration_response.app_attest_key_id,
      idempotencyKey })).rejects.toMatchObject({ kind: "authentication" }); expect(fetch).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort();
    await expect(transport.issueRegistration({ appAttestKeyId: app.registration_response.app_attest_key_id,
      idempotencyKey, signal: controller.signal })).rejects.toMatchObject({ kind: "aborted" });
  });
});

function pairedAssertion() { return { ...app.assertion_challenge, claimant_id: native.challenge.claimant_id,
  claimant_key_id: native.challenge.claimant_key_id, claimant_key_version: native.challenge.claimant_key_version,
  invitation_reference: native.challenge.invitation_reference, invitation_version: native.challenge.invitation_version,
  public_key_fingerprint: native.challenge.public_key_fingerprint } as const; }
function encoded(value: object): string { return Buffer.from(canonicalJsonBytes(value as never)).toString("base64url"); }
function response(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { status,
  headers: { "Content-Type": "application/json" } }); }
