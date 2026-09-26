import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { canonicalJson, encodeOfflineCodeSheetV2, type OfflineCodeChallengeV2,
  type OfflineCodePossessionProofV2, type OfflineCodeSheetV2 } from "@vault/shared-types";
import { describe, expect, it, vi } from "vitest";

import type { SheetCheckFlow } from "@/features/claimant-journey/sheet-check-flow";

import { CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED } from "./offline-code-v2-coordinator";
import { CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED, type OfflineCodeV2LifecycleSource } from "./offline-code-v2-lifecycle";
import { CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED } from "./offline-code-v2-proof-core";
import { CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED } from "./offline-code-v2-transport";
import { createSheetCheckHandle, useSheetCheckHandle } from "./sheet-check-runtime";

vi.mock("react", () => ({ useMemo: (factory: () => unknown) => factory() }));
vi.mock("react-native", () => ({ AppState: { currentState: "active",
  addEventListener: () => ({ remove: () => undefined }) } }));
const keys = vi.hoisted(() => ({ next: 0 }));
vi.mock("expo-crypto", () => ({
  randomUUID: () => `60000000-0000-4000-8000-${String(++keys.next).padStart(12, "0")}` }));
vi.mock("expo/fetch", () => ({ fetch: vi.fn(() => { throw new Error("no network in tests"); }) }));

const vector = JSON.parse(readFileSync(resolve(process.cwd(),
  "../../packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as {
    public_locator: OfflineCodeSheetV2["publicLocator"]; synthetic_client_secret: OfflineCodeSheetV2["clientSecret"];
    kdf_profile: OfflineCodeSheetV2["kdfProfile"]; record_binding: OfflineCodeSheetV2["recordBinding"];
    challenge: OfflineCodeChallengeV2; possession_proof: OfflineCodePossessionProofV2 };
const sheetText = encodeOfflineCodeSheetV2({ publicLocator: vector.public_locator,
  clientSecret: vector.synthetic_client_secret, kdfProfile: vector.kdf_profile, recordBinding: vector.record_binding });
const origins = { api: "https://api.sanduqkin.test", claimant: vector.challenge.origin };
const env = { EXPO_PUBLIC_API_URL: origins.api, EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: origins.claimant };
const verified = { status: "proof_verified", authority: "route_possession_only", route_possession_asserted: true,
  identity_verified: false, claim_created: false, release_authorized: false };
const random = (length: number) => Buffer.from(Array.from({ length }, (_, index) => index + 7)).toString("base64url");
const decoy: OfflineCodeChallengeV2 = { ...vector.challenge, locator_record_id: "50000000-0000-4000-8000-00000000000f",
  locator_commitment: random(32), proof_public_key: random(32), record_binding_digest: random(32) };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json",
    "Cache-Control": "no-store", "Access-Control-Allow-Origin": origins.claimant } });
}
function issued(challenge: OfflineCodeChallengeV2, salt = vector.kdf_profile.salt) {
  return json({ result: { status: "challenge_issued", authority: "route_possession_only", challenge,
    challenge_bytes_base64url: Buffer.from(canonicalJson(challenge as never)).toString("base64url"),
    kdf_profile: { ...vector.kdf_profile, salt }, identity_verified: false, claim_created: false,
    release_authorized: false } });
}

function harness(server: (url: string) => Response | Promise<Response>, options: { realProducer?: boolean } = {}) {
  const send = vi.fn(async (url: string, _init?: RequestInit) => server(url));
  const produce = vi.fn(async () => vector.possession_proof);
  const cleanup = vi.fn();
  const lifecycle: OfflineCodeV2LifecycleSource = { subscribe(listener) {
    listener({ sequence: 0, state: "foreground" }); return cleanup; } };
  const handle = createSheetCheckHandle({ approved: true, env, send, lifecycle,
    producer: options.realProducer ? undefined : { produce },
    now: () => new Date(Date.parse(vector.challenge.issued_at) + 1_000) });
  if (!handle) throw new Error("handle expected");
  return { send, produce, cleanup, flow: handle.open() };
}
async function settle(flow: SheetCheckFlow) {
  await flow.submit(sheetText);
  return flow.snapshot().status;
}

describe("claimant sheet check runtime", () => {
  it("is null outside the Preview build, before reading any configuration", () => {
    expect(useSheetCheckHandle()).toBeNull();
    const touched = vi.fn(() => { throw new Error("private configuration"); });
    expect(createSheetCheckHandle({ env: Object.defineProperties({}, {
      EXPO_PUBLIC_API_URL: { get: touched }, EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: { get: touched } }) }))
      .toBeNull();
    expect(touched).not.toHaveBeenCalled();
  });

  it("keeps every chain approval literal false", () => {
    expect([CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED, CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED,
      CLAIMANT_OFFLINE_CODE_V2_TRANSPORT_APPROVED, CLAIMANT_OFFLINE_CODE_V2_CLIENT_PROOF_APPROVED])
      .toEqual([false, false, false, false]);
  });

  it.each([
    {}, { EXPO_PUBLIC_API_URL: origins.api }, { EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: origins.claimant },
    { ...env, EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: origins.api },
    { ...env, EXPO_PUBLIC_API_URL: "http://api.sanduqkin.test" },
    { ...env, EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN: `${origins.claimant}/claim` },
  ])("is null without two distinct HTTPS origins %j", (value) => {
    expect(createSheetCheckHandle({ approved: true, env: value })).toBeNull();
  });

  it("checks a live sheet: challenge, on-device proof, proof submit, and nothing else is sent", async () => {
    const h = harness((url) => url.endsWith("/proofs") ? json({ result: verified }) : issued(vector.challenge));
    expect(await settle(h.flow)).toBe("valid");
    expect(h.send.mock.calls.map(([url]) => url)).toEqual([`${origins.api}/claimant/offline-code/v2/challenges`,
      `${origins.api}/claimant/offline-code/v2/challenges/${vector.challenge.challenge_id}/proofs`]);
    expect(h.produce).toHaveBeenCalledOnce();
    for (const [, init] of h.send.mock.calls) {
      expect(String(init?.body)).not.toContain(vector.synthetic_client_secret.secret);
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
    }
    h.flow.dispose();
    expect(h.cleanup).toHaveBeenCalledOnce();
  });

  it("reports a revoked or unknown sheet's decoy challenge as can't be used without proving", async () => {
    const h = harness(() => issued(decoy, random(16)));
    expect(await settle(h.flow)).toBe("unusable");
    expect(h.produce).not.toHaveBeenCalled();
    expect(h.send).toHaveBeenCalledOnce();
  });

  it("reports a refused proof as can't be used", async () => {
    const h = harness((url) => url.endsWith("/proofs") ? json({ result: { ...verified, status: "proof_rejected",
      route_possession_asserted: false } }, 401) : issued(vector.challenge));
    expect(await settle(h.flow)).toBe("unusable");
  });

  it.each([
    ["the network fails", () => { throw new TypeError("Network request failed"); }],
    ["the server fails", () => json({ error: "unavailable" }, 503)],
    ["the check is rate limited", () => json({ error: "slow down" }, 429)],
  ])("asks to try again when %s, and the retry starts a fresh check", async (_name, failure) => {
    let fail = true;
    const h = harness((url) => fail ? failure() : url.endsWith("/proofs") ? json({ result: verified })
      : issued(vector.challenge));
    expect(await settle(h.flow)).toBe("failed");
    fail = false; h.flow.reset();
    expect(await settle(h.flow)).toBe("valid");
  });

  it("asks to try again when the proof submit fails after the device proved", async () => {
    const h = harness((url) => url.endsWith("/proofs") ? json({ error: "unavailable" }, 502) : issued(vector.challenge));
    expect(await settle(h.flow)).toBe("failed");
    expect(h.produce).toHaveBeenCalledOnce();
  });

  it("opens the platform proof producer for the Preview path only through its own approval", async () => {
    const h = harness((url) => url.endsWith("/proofs") ? json({ result: verified }) : issued(vector.challenge),
      { realProducer: true });
    expect(await settle(h.flow)).toBe("valid");
    const body = JSON.parse(String(h.send.mock.calls[1][1]?.body));
    expect(body.possession_proof.signature === vector.possession_proof.signature).toBe(true);
  });
});
