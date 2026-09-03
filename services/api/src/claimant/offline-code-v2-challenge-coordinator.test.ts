import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED,
  createOfflineCodeV2ChallengeCoordinator }
  from "./offline-code-v2-challenge-coordinator.js";

const locator = "SK2-L-M6HA-7955-MTKT-HADA-NEPA-VBNF-P0-F";

describe("offline-code V2 challenge coordinator", () => {
  it("is immutable-false before parsing or touching dependencies", async () => {
    expect(CLAIMANT_OFFLINE_CODE_V2_CHALLENGE_COORDINATOR_APPROVED).toBe(false);
    const indexer = { derive: vi.fn() }; const persistence = { issueChallenge: vi.fn() };
    await expect(coordinator({ indexer, persistence }).issue({ locator: "bad" }))
      .rejects.toMatchObject({ kind: "disabled" });
    expect(indexer.derive).not.toHaveBeenCalled(); expect(persistence.issueChallenge).not.toHaveBeenCalled();
  });

  it("normalizes only V2 locators and returns a possession-only constant challenge", async () => {
    const indexer = { derive: vi.fn(async () => digests()) };
    const persistence = { issueChallenge: vi.fn(async () => issued()) };
    const result = await coordinator({ approved: true, indexer, persistence }).issue(request());
    expect(indexer.derive).toHaveBeenCalledWith({ normalizedLocator: "M6HA7955MTKTHADANEPAVBNFP0",
      networkSignal: "opaque-network-signal", deviceSignal: "opaque-device-signal" });
    expect(persistence.issueChallenge).toHaveBeenCalledWith({ ...digests(),
      origin: "https://claim.synthetic.test", idempotencyKey: id("12") });
    expect(result).toMatchObject({ status: "challenge_issued", authority: "route_possession_only",
      identityVerified: false, claimCreated: false, releaseAuthorized: false });
    expect(result).not.toHaveProperty("replayed"); expect(result).not.toHaveProperty("recordFound");
    expect(result).not.toHaveProperty("challengeBytesDigest");
  });

  it("returns the same bounded limiter result without challenge or record state", async () => {
    const result = await coordinator({ approved: true,
      indexer: { derive: vi.fn(async () => digests()) }, persistence: { issueChallenge: vi.fn(async () => ({
        rateLimited: true as const, retryAfterSeconds: 300 as const, identityVerified: false as const,
        claimCreated: false as const, releaseAuthorized: false as const, replayed: false as const })) } })
      .issue(request());
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 300,
      identityVerified: false, claimCreated: false, releaseAuthorized: false });
  });

  it("rejects V1, secrets, malformed locators, extras, and invalid boundary digests", async () => {
    const base = { approved: true, indexer: { derive: vi.fn(async () => digests()) },
      persistence: { issueChallenge: vi.fn(async () => issued()) } };
    for (const hostile of [{ ...request(), locator: "SK1-AAAA-BBBB" },
      { ...request(), locator: "SK2-S-M6HA-7955-MTKT-HADA-NEPA-VBNF-P0-F" },
      { ...request(), locator: `${locator}A` }, { ...request(), clientSecret: "prohibited" },
      { ...request(), networkSignal: "" }])
      await expect(coordinator(base).issue(hostile)).rejects.toMatchObject({ kind: "invalid_input" });
    await expect(coordinator({ ...base, indexer: { derive: vi.fn(async () => ({
      ...digests(), locatorIndexDigest: "invalid" })) } }).issue(request()))
      .rejects.toMatchObject({ kind: "boundary_failure" });
  });
});

function coordinator(overrides: Record<string, unknown>) { return createOfflineCodeV2ChallengeCoordinator({
  approved: overrides.approved as boolean | undefined,
  origin: "https://claim.synthetic.test", indexer: overrides.indexer as never,
  persistence: overrides.persistence as never }); }
function request() { return { locator, networkSignal: "opaque-network-signal",
  deviceSignal: "opaque-device-signal", idempotencyKey: id("12") }; }
function digests() { return { locatorIndexDigest: digest("L"), networkBucketDigest: digest("I"),
  deviceBucketDigest: digest("E"), globalBucketDigest: digest("G") }; }
function issued() { return { rateLimited: false as const, challenge: { authority: "route_possession_only",
  challenge_id: id("02"), expires_at: "2026-08-19T08:05:00.000Z",
  issued_at: "2026-08-19T08:00:00.000Z", locator_commitment: digest("C"),
  locator_record_id: id("01"), locator_version: 2 as const, nonce: digest("N"),
  origin: "https://claim.synthetic.test", proof_key_version: 1 as const,
  proof_public_key: digest("P"), protocol: "sanduqkin:claim:offline-code:v2" as const,
  purpose: "possession_challenge" as const, record_binding_digest: digest("B") },
  challengeBytesBase64url: "Q".repeat(80), challengeBytesDigest: digest("D"),
  kdfProfile: { algorithm: "argon2id" as const, memlimit_bytes: 67_108_864 as const,
    opslimit: 2 as const, output_bytes: 32 as const, production_approved: false as const,
    profile_id: "argon2id-synthetic-test-v2" as const,
    protocol: "sanduqkin:claim:offline-code:v2" as const, purpose: "client_secret_root" as const,
    salt: `${"K".repeat(21)}A` }, identityVerified: false as const, claimCreated: false as const,
  releaseAuthorized: false as const, replayed: false }; }
function digest(character: string) { return `${character.repeat(42)}Q`; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
