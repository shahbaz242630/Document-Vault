import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, type OfflineCodeChallengeV2, type OfflineCodeKdfProfileV2,
  type OfflineCodePossessionProofV2 } from "@vault/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOfflineCodeV2Transport, OfflineCodeV2UnavailableError } from "./offline-code-v2-transport";

const apiOrigin = "https://api.sanduqkin.test";
const key = "40000000-0000-4000-8000-000000000099";
const success = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false } as const;
const unavailable = { name: "OfflineCodeV2UnavailableError", message: "Offline-code request is unavailable." };

afterEach(() => vi.useRealTimers());

describe("offline-code V2 isolated transport", () => {
  it("touches no adapter when disabled or already cancelled", async () => {
    const h = harness(false);
    await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    await expect(h.transport.verifyProof(h.proof())).rejects.toMatchObject(unavailable);
    expect(h.send).not.toHaveBeenCalled();
    const enabled = harness();
    const controller = new AbortController(); controller.abort();
    await expect(enabled.transport.issueChallenge({ ...enabled.issue(), signal: controller.signal })).rejects.toMatchObject(unavailable);
    expect(enabled.send).not.toHaveBeenCalled();
  });

  it("uses exact paths and allowlisted bodies, with no secret, identity header, cookie, or URL material", async () => {
    const h = harness();
    const issued = await h.transport.issueChallenge(h.issue());
    expect(issued.challengeBytesBase64url === h.bytes).toBe(true);
    expect(Object.isFrozen(issued.challenge)).toBe(true);
    await expect(h.transport.verifyProof(h.proof())).resolves.toEqual(success);
    for (const [url, init] of h.send.mock.calls) {
      const headers = new Headers(init?.headers);
      expect([...headers.keys()].sort()).toEqual(["accept", "content-type", "idempotency-key", "origin"]);
      expect(init).toMatchObject({ method: "POST", credentials: "omit", cache: "no-store",
        redirect: "error", referrerPolicy: "no-referrer" });
      expect(String(url)).not.toContain("?");
      expect(String(url)).not.toContain(h.fixture.public_locator.locator);
      expect(String(init?.body)).not.toContain(h.fixture.synthetic_client_secret.secret);
      expect(String(init?.body)).not.toContain("owner_id");
      expect(String(init?.body)).not.toContain("grant_id");
    }
    expect(Object.keys(JSON.parse(String(h.send.mock.calls[0][1]?.body)))).toEqual(["locator"]);
    expect(Object.keys(JSON.parse(String(h.send.mock.calls[1][1]?.body))).sort()).toEqual(
      ["challenge", "challenge_bytes_base64url", "possession_proof"]);
    expect(h.send.mock.calls[1][0]).toBe(`${apiOrigin}/claimant/offline-code/v2/challenges/${h.fixture.challenge.challenge_id}/proofs`);
  });

  it.each(["http://api.test", "https://api.test/", "https://user@api.test", "https://api.test?x=1",
    "https://api.test#x", "https://api.test/path"])("rejects invalid API origin %s before sending", async (origin) => {
    const h = harness(true, origin);
    await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("rejects equal origins, V1 locator, invalid idempotency, and cross-challenge proof before sending", async () => {
    const h = harness();
    const same = harness(true, h.fixture.challenge.origin);
    await expect(same.transport.issueChallenge(same.issue())).rejects.toMatchObject(unavailable);
    expect(same.send).not.toHaveBeenCalled();
    await expect(h.transport.issueChallenge({ ...h.issue(), locator: "SK1-legacy" })).rejects.toMatchObject(unavailable);
    await expect(h.transport.issueChallenge({ ...h.issue(), idempotencyKey: "bad" })).rejects.toMatchObject(unavailable);
    const request = h.proof();
    await expect(h.transport.verifyProof({ ...request, possessionProof: { ...request.possessionProof,
      challenge_id: key } })).rejects.toMatchObject(unavailable);
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 409, 429, 500, 503])("redacts response details for HTTP %i", async (status) => {
    const h = harness();
    h.send.mockResolvedValueOnce(new Response("private upstream error", { status }));
    await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
  });

  it("rejects noncanonical challenge bytes, upgraded authority, extra fields, and unapproved KDF", async () => {
    const mutations = [
      (r: Record<string, unknown>) => { r.challenge_bytes_base64url = `${r.challenge_bytes_base64url}=`; },
      (r: Record<string, unknown>) => { r.identity_verified = true; },
      (r: Record<string, unknown>) => { r.owner_id = key; },
      (r: Record<string, unknown>) => { r.authority = "release_authorized"; },
      (r: Record<string, unknown>) => { (r.kdf_profile as Record<string, unknown>).production_approved = true; },
    ];
    for (const mutate of mutations) {
      const h = harness(); const body = h.challengeBody(); mutate(body.result);
      h.send.mockResolvedValueOnce(h.response(body));
      await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    }
    const h = harness();
    h.send.mockResolvedValueOnce(h.response({ result: { ...success, claim_created: true } }));
    await expect(h.transport.verifyProof(h.proof())).rejects.toMatchObject(unavailable);
  });

  it.each([
    { "Content-Type": "text/html" }, { "Cache-Control": "public" },
    { "Access-Control-Allow-Origin": "*" }, { "Content-Length": "16385" },
    { "Content-Length": "nope" }, { "Content-Length": "1" },
  ] as Record<string, string>[])("rejects unsafe response headers %j", async (headers) => {
    const h = harness(); h.send.mockResolvedValueOnce(h.response(h.challengeBody(), headers));
    await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
  });

  it("rejects oversized streams, malformed JSON, invalid UTF-8, and absent streams", async () => {
    for (const body of ["x".repeat(16_385), "{bad", Uint8Array.of(255), null]) {
      const h = harness(); h.send.mockResolvedValueOnce(new Response(body, { headers: h.headers() }));
      await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    }
  });

  it("rejects redirected and substituted response URLs", async () => {
    for (const property of ["redirected", "url"]) {
      const h = harness(); const response = h.response(h.challengeBody());
      Object.defineProperty(response, property, { value: property === "url" ? "https://evil.test/" : true });
      h.send.mockResolvedValueOnce(response);
      await expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    }
  });

  it("bounds a hung adapter and aborts its signal without an automatic retry", async () => {
    vi.useFakeTimers();
    const h = harness(); h.send.mockImplementationOnce(async () => new Promise<Response>(() => undefined));
    const result = expect(h.transport.issueChallenge(h.issue())).rejects.toMatchObject(unavailable);
    await vi.advanceTimersByTimeAsync(15_000); await result;
    expect(h.send).toHaveBeenCalledOnce();
    expect(h.send.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("cancels stalled body reads and does not wait for an uncooperative stream", async () => {
    const h = harness(); const cancel = vi.fn();
    const response = new Response(new ReadableStream({ pull() { return new Promise(() => undefined); }, cancel }),
      { headers: h.headers() });
    h.send.mockResolvedValueOnce(response);
    const controller = new AbortController();
    const pending = expect(h.transport.issueChallenge({ ...h.issue(), signal: controller.signal })).rejects.toMatchObject(unavailable);
    await Promise.resolve(); await Promise.resolve(); controller.abort(); await pending;
  });

  it("consumes late adapter rejection after cancellation without exposing its error", async () => {
    const h = harness(); let reject!: (reason: Error) => void;
    h.send.mockImplementationOnce(() => new Promise<Response>((_, fail) => { reject = fail; }));
    const controller = new AbortController();
    const result = expect(h.transport.issueChallenge({ ...h.issue(), signal: controller.signal })).rejects.toMatchObject(unavailable);
    controller.abort(); await result; reject(new Error("private native detail"));
    await Promise.resolve();
    expect(new OfflineCodeV2UnavailableError().message).not.toContain("private");
  });
});

function harness(approved = true, origin = apiOrigin) {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(),
    "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
      public_locator: { locator: string }; synthetic_client_secret: { secret: string };
      challenge: OfflineCodeChallengeV2; kdf_profile: OfflineCodeKdfProfileV2;
      possession_proof: OfflineCodePossessionProofV2;
    };
  const bytes = Buffer.from(canonicalJson(fixture.challenge as never)).toString("base64url");
  const headers = () => ({ "Content-Type": "application/json", "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": fixture.challenge.origin });
  const response = (body: unknown, overrides: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { headers: { ...headers(), ...overrides } });
  const challengeBody = () => ({ result: { status: "challenge_issued", authority: "route_possession_only",
    challenge: structuredClone(fixture.challenge), challenge_bytes_base64url: bytes,
    kdf_profile: structuredClone(fixture.kdf_profile), identity_verified: false,
    claim_created: false, release_authorized: false } as Record<string, unknown> });
  const send = vi.fn<typeof fetch>(async (url) => response(String(url).endsWith("/proofs")
    ? { result: success } : challengeBody()));
  const transport = createOfflineCodeV2Transport({ ...(approved ? { approved: true } : {}),
    apiOrigin: origin, claimantOrigin: fixture.challenge.origin, send });
  const issue = () => ({ locator: fixture.public_locator.locator, idempotencyKey: key, signal: new AbortController().signal });
  const proof = () => ({ challenge: fixture.challenge, challengeBytesBase64url: bytes,
    possessionProof: fixture.possession_proof, idempotencyKey: key, signal: new AbortController().signal });
  return { fixture, bytes, headers, response, challengeBody, send, transport, issue, proof };
}
