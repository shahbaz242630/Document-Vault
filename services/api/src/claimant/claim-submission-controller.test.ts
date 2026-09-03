import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { CLAIMANT_SUBMISSION_CONTROLLER_APPROVED, createClaimSubmissionConcurrencyGuardV1,
  createClaimSubmissionControllerV1, createClaimSubmissionPreflightControllerV1 }
  from "./claim-submission-controller.js";
import { ClaimSubmissionTransactionError } from "./claim-submission-transaction-client.js";
import { getClaimantRuntimeConfig } from "./runtime-config.js";

const ids = { case: "60000000-0000-4000-8000-000000000001",
  otherCase: "60000000-0000-4000-8000-000000000002",
  user: "60000000-0000-4000-8000-000000000003",
  session: "60000000-0000-4000-8000-000000000004",
  request: "60000000-0000-4000-8000-000000000005" };
const apiOrigin = "https://api.sanduqkin.test";
const claimantOrigin = "https://claimant.sanduqkin.test";
const now = new Date("2026-08-12T12:01:00.000Z");

describe("claim submission controller", () => {
  it("is statically concealed before configuration or clients are touched", async () => {
    expect(CLAIMANT_SUBMISSION_CONTROLLER_APPROVED).toBe(false);
    const getConfig = vi.fn(); const response = await app({ getConfig }).request(url(), request());
    expect(response.status).toBe(404); expect(getConfig).not.toHaveBeenCalled();
  });

  it("conceals exact API and claimant origin mismatches before authentication", async () => {
    const deps = approved();
    const portal = await app(deps).request(url(), request({}, { Origin: "https://evil.test" }));
    const api = await app(deps).request(`https://alternate.test/cases/${ids.case}/submissions`, request());
    expect(portal.status).toBe(404); expect(api.status).toBe(404);
    expect(deps.createPortalClient).not.toHaveBeenCalled();
  });

  it("submits only after fresh AAL2 and active portal assertion and returns a safe acknowledgement", async () => {
    const deps = approved(); const response = await app(deps).request(url(), request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: {
      acknowledgement_ref: `synthetic_acknowledgement_${"a".repeat(32)}`,
      case_id: ids.case, case_version: 3, intake_version: 9, preparation_version: 2,
      release_authorized: false, replayed: false, review_started: false, state: "submitted",
      status: "received_for_review" } });
    expect(deps.portal.assert).toHaveBeenCalledWith(ids.user, ids.session);
    expect(deps.transactions.submit).toHaveBeenCalledWith(expect.objectContaining({
      caseId: ids.case, claimantUserId: ids.user, idempotencyKey: ids.request,
      portalSessionId: ids.session }));
  });

  it("rejects stale or recovery assurance before portal and transaction authority", async () => {
    for (const amr of [[{ method: "totp", timestamp: 1 }],
      [{ method: "totp", timestamp: epoch() }, { method: "recovery", timestamp: epoch() }]]) {
      const deps = approved(); deps.portal.getSession.mockResolvedValueOnce(session({ amr }));
      const response = await app(deps).request(url(), request());
      expect(response.status).toBe(403); expect(deps.portal.assert).not.toHaveBeenCalled();
      expect(deps.transactions.submit).not.toHaveBeenCalled();
    }
  });

  it("binds the route case and header idempotency to the strict envelope", async () => {
    for (const envelope of [validEnvelope({ case_ref: ids.otherCase }),
      validEnvelope({ idempotency_key: "60000000-0000-4000-8000-000000000006" })]) {
      const deps = approved(); const response = await app(deps).request(url(),
        request({ envelope }));
      expect(response.status).toBe(400); expect(deps.transactions.submit).not.toHaveBeenCalled();
    }
  });

  it("enforces exact media, UUID, body-size, and preflight header boundaries", async () => {
    const deps = approved();
    expect((await app(deps).request(url(), request({}, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await app(deps).request(url(), request({}, { "Content-Length": "20000" }))).status).toBe(413);
    expect((await app(deps).request(`${apiOrigin}/cases/not-a-case/submissions`, request())).status).toBe(400);
    const preflight = await app(deps).request(url(), { method: "OPTIONS", headers: {
      Origin: claimantOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key" } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(claimantOrigin);
    const hostile = await app(deps).request(url(), { method: "OPTIONS", headers: {
      Origin: claimantOrigin, "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Authorization, Content-Type, Idempotency-Key, X-Extra" } });
    expect(hostile.status).toBe(404);
  });

  it("returns bounded contention before creating transaction authority", async () => {
    const deps = approved(); const response = await app({ ...deps,
      concurrency: { acquire: vi.fn(() => null) } }).request(url(), request());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.text()).toBe('{"error":"Request could not be completed"}');
    expect(deps.createTransactions).not.toHaveBeenCalled();
  });

  it("maps authority conflicts generically and never leaks database detail", async () => {
    const deps = approved();
    deps.transactions.submit.mockRejectedValueOnce(new ClaimSubmissionTransactionError("40001"));
    const conflict = await app(deps).request(url(), request());
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).toBe('{"error":"Request could not be completed"}');
    deps.transactions.submit.mockRejectedValueOnce(new Error("private database topology"));
    const failure = await app(deps).request(url(), request());
    expect(failure.status).toBe(500); expect(await failure.text()).not.toContain("topology");
  });

  it("uses a bounded claimant-case concurrency guard", () => {
    const guard = createClaimSubmissionConcurrencyGuardV1(); const release = guard.acquire("claimant|case");
    expect(release).toBeTypeOf("function"); expect(guard.acquire("claimant|case")).toBeNull();
    release!(); expect(guard.acquire("claimant|case")).toBeTypeOf("function");
    expect(() => createClaimSubmissionConcurrencyGuardV1(3)).toThrow(/bound/u);
  });
});

function app(deps: Parameters<typeof createClaimSubmissionControllerV1>[0]) {
  const result = new Hono(); result.post("/cases/:caseId/submissions",
    createClaimSubmissionControllerV1(deps)); result.options("/cases/:caseId/submissions",
    createClaimSubmissionPreflightControllerV1(deps)); return result;
}
function url() { return `${apiOrigin}/cases/${ids.case}/submissions`; }
function request(changes: Record<string, unknown> = {}, headerChanges: Record<string, string> = {}) {
  return { method: "POST", headers: { Authorization: "Bearer jwt", "Content-Type": "application/json",
    "Idempotency-Key": ids.request, Origin: claimantOrigin, ...headerChanges },
  body: JSON.stringify({ envelope: validEnvelope(), expected_intake_version: 9,
    expected_preparation_version: 2, ...changes }) };
}
function validEnvelope(changes = {}) { return {
  protocol: "sanduqkin:claim:review-submission-envelope:v1", synthetic_only: true,
  production_approved: false, runtime_submission_authorized: false, release_authorized: false,
  status: "assembled_for_review_submission", submission_ref: "synthetic_submission_alpha_001",
  idempotency_key: ids.request, case_ref: ids.case, expected_case_version: 2,
  policy_id: "synthetic_policy_death_alpha", policy_version: 1,
  evidence_bundle_ref: "synthetic_bundle_alpha_001", evidence_manifest: [
    { item_key: "claimant_photo_identity", placeholder_ref: "synthetic_evidence_001" }],
  declarations: ["information_is_accurate", "evidence_is_lawfully_held",
    "known_conflicts_are_disclosed", "review_is_not_release"],
  created_at: "2026-08-12T12:00:00.000Z", ...changes };
}
function approved() {
  const portal = { activate: vi.fn(), assert: vi.fn().mockResolvedValue({ context: "claimant_portal",
    sessionVersion: 1 }), getSession: vi.fn().mockResolvedValue(session()), revoke: vi.fn() };
  const transactions = { submit: vi.fn().mockResolvedValue({
    acknowledgementRef: `synthetic_acknowledgement_${"a".repeat(32)}`, caseId: ids.case,
    caseVersion: 3, intakeVersion: 9, preparationVersion: 2, releaseAuthorized: false,
    replayed: false, reviewStarted: false, state: "submitted", status: "received_for_review" }) };
  return { approved: true as const, createPortalClient: vi.fn(() => portal),
    createTransactions: vi.fn(() => transactions), getConfig: vi.fn(() => ({ apiOrigin,
      claimantOrigin, freshAssuranceSeconds: 600, serviceRoleKey: "service-role",
      supabaseUrl: "https://db.test" })), now: () => now, portal,
    runtimeConfig: getClaimantRuntimeConfig({ NODE_ENV: "test", CLAIMANT_RUNTIME_ENABLED: "true",
      CLAIMANT_AUTHENTICATION_ENABLED: "true", CLAIMANT_REGISTERED_RECIPIENT_ENABLED: "true",
      CLAIMANT_INTAKE_ENABLED: "true" }), transactions };
}
function epoch() { return Math.floor(now.getTime() / 1000); }
function session(changes = {}) { return { aal: "aal2" as const,
  amr: [{ method: "totp", timestamp: epoch() }], expiresAt: epoch() + 3600,
  issuedAt: epoch() - 60, sessionId: ids.session, userId: ids.user, ...changes }; }
