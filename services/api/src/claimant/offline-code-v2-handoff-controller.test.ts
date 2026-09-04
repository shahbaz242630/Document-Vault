import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED,
  createOfflineCodeV2HandoffController, createOfflineCodeV2HandoffPreflightController }
  from "./offline-code-v2-handoff-controller.js";
import { handoffCompleteSchema, handoffIssueSchema } from "./offline-code-v2-handoff-service.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://app.sanduqkin.test";

describe("offline-code V2 authenticated handoff controller", () => {
  it("is literal-false and concealed without touching injected services", async () => {
    const deps = approved();
    const response = await app("issue", { ...deps, approved: false }).request(url("issue"), request({
      challengeId: id("01") }));
    expect(CLAIMANT_OFFLINE_CODE_V2_HANDOFF_CONTROLLER_APPROVED).toBe(false);
    expect(response.status).toBe(404); expect(deps.service.issue).not.toHaveBeenCalled();
  });

  it("accepts exact authenticated issue/complete envelopes with safe headers", async () => {
    const deps = approved();
    const issued = await app("issue", deps).request(url("issue"), request({ challengeId: id("01") }));
    expect(issued.status).toBe(200); expect(issued.headers.get("Cache-Control")).toBe("private, no-store");
    expect(deps.service.issue).toHaveBeenCalledWith("synthetic-jwt", id("02"), { challengeId: id("01") });
    const completed = await app("complete", deps).request(url("complete"), request({
      handoffId: id("03"), signature: "A".repeat(85) + "Q" }));
    expect(completed.status).toBe(200);
    expect(deps.service.complete).toHaveBeenCalledWith("synthetic-jwt", id("02"), {
      handoffId: id("03"), signature: "A".repeat(85) + "Q" });
  });

  it("conceals origin, cookie, capability, and malformed auth; rejects client authority", async () => {
    const deps = approved();
    for (const overrides of [{ Origin: "https://hostile.test" }, { Cookie: "session=no" },
      { Authorization: "Basic no" }] as Record<string, string>[]) {
      expect((await app("issue", deps).request(url("issue"), request({ challengeId: id("01") }, overrides))).status)
        .not.toBe(200);
    }
    const disabled = { ...deps, runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test" }) };
    expect((await app("issue", disabled).request(url("issue"), request({ challengeId: id("01") }))).status)
      .toBe(404);
    expect((await app("issue", deps).request(url("issue"), request({ challengeId: id("01"),
      claimantUserId: id("04"), portalSessionId: id("05"), caseId: id("06") }))).status).toBe(403);
    expect((await app("issue", deps).request(url("issue"), request({ challengeId: id("01") },
      { "Content-Length": "20000" }))).status).toBe(403);
  });

  it("allows only the exact authenticated preflight", async () => {
    const deps = approved(); const route = app("issue", deps);
    const exact = await route.request(url("issue"), { method: "OPTIONS", headers: {
      Origin: claimantOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key" } });
    expect(exact.status).toBe(204);
    const hostile = await route.request(url("issue"), { method: "OPTIONS", headers: {
      Origin: claimantOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, X-Authority" } });
    expect(hostile.status).toBe(404);
  });
});

function approved() {
  const service = { issue: vi.fn(async (_jwt: string, _key: string, body: unknown) => {
    handoffIssueSchema.parse(body); return { handoff_id: id("03"),
      transcript_bytes_base64url: "A".repeat(128), expires_at: "2030-01-01T00:00:00.000Z",
      authority: "route_possession_only" as const, identity_verified: false as const,
      claim_created: false as const, release_authorized: false as const };
  }), complete: vi.fn(async (_jwt: string, _key: string, body: unknown) => {
    handoffCompleteSchema.parse(body); return { case_id: id("04"), case_version: 1 as const,
      state: "draft" as const, route_profile: "offline_code_v2" as const,
      authority: "route_possession_only" as const, claimant_session_bound: true as const,
      case_created: true as const, identity_verified: false as const,
      relationship_verified: false as const, intake_started: false as const,
      review_started: false as const, release_authorized: false as const, replayed: false };
  }) };
  return { approved: true, service, config: { apiOrigin, claimantOrigin },
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_OFFLINE_CODE_V2_ENABLED: "true" }) };
}
function app(action: "issue" | "complete", deps: Parameters<typeof createOfflineCodeV2HandoffController>[1]) {
  const instance = new Hono(); const path = `/claimant/offline-code/v2/handoffs/${action}`;
  instance.post(path, createOfflineCodeV2HandoffController(action, deps));
  instance.options(path, createOfflineCodeV2HandoffPreflightController(deps)); return instance;
}
function request(body: unknown, overrides: Record<string, string> = {}) { return { method: "POST",
  headers: { Origin: claimantOrigin, Authorization: "Bearer synthetic-jwt",
    "Content-Type": "application/json", "Idempotency-Key": id("02"), ...overrides },
  body: JSON.stringify(body) }; }
function url(action: string) { return `${apiOrigin}/claimant/offline-code/v2/handoffs/${action}`; }
function id(suffix: string) { return `10000000-0000-4000-8000-0000000000${suffix}`; }
