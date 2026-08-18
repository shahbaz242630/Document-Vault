import { describe, expect, it, vi } from "vitest";

import { createRetrievalSessionTransactionClientV1 }
  from "./retrieval-session-transaction-client.js";

describe("retrieval session transaction client", () => {
  it("maps the exact claimant portal and release-ready bindings", async () => {
    const rpc = vi.fn(async () => ({ data: result(), error: null }));
    await expect(createRetrievalSessionTransactionClientV1(rpc).authorize(input()))
      .resolves.toMatchObject({ caseState: "release_ready", sessionAuthorized: true,
        packageServingAuthorized: false, packageServed: false, retrievalCompleted: false });
    expect(rpc).toHaveBeenCalledWith("claimant_authorize_release_retrieval_session",
      expect.objectContaining({ p_claimant_user_id: id("09"),
        p_portal_session_id: id("10"), p_authenticated_at: "2026-08-18T11:59:00.000Z",
        p_grant_id: id("11"), p_recipient_key_id: id("31") }));
  });
  it("rejects errors and any unsafe, extra, or incoherent response", async () => {
    const client = (data: unknown, error: { code?: string } | null = null) =>
      createRetrievalSessionTransactionClientV1(async () => ({ data, error }));
    await expect(client(null, { code: "40001" }).authorize(input()))
      .rejects.toMatchObject({ code: "40001" });
    for (const hostile of [{ ...result(), package_serving_authorized: true },
      { ...result(), package_served: true }, { ...result(), retrieval_completed: true },
      { ...result(), case_state: "released" }, { ...result(), case_version: 8 },
      { ...result(), signed_url: "forbidden" }]) {
      await expect(client(hostile).authorize(input())).rejects.toThrow(/invalid result/u);
    }
  });
});

function input() { return { authenticatedAt: "2026-08-18T11:59:00.000Z",
  caseId: id("01"), claimantUserId: id("09"), expectedCaseVersion: 7,
  finalizationId: id("02"), grantId: id("11"), idempotencyKey: id("03"),
  packageId: id("04"), portalSessionId: id("10"), recipientKeyId: id("31"),
  retrievalSessionId: id("05") }; }
function result() { return { case_id: id("01"), case_state: "release_ready",
  case_version: 7, finalization_id: id("02"), grant_id: id("11"),
  package_served: false, package_serving_authorized: false, portal_session_version: 2,
  recipient_key_id: id("31"), release_package_id: id("04"), replayed: false,
  retrieval_completed: false, retrieval_session_expires_at: "2026-08-18T12:15:00.000Z",
  retrieval_session_id: id("05"), retrieval_session_status: "authorized_unserved",
  session_authorized: true }; }
function id(suffix: string) { return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`; }
