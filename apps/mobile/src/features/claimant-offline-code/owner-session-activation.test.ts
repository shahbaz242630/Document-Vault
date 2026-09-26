import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError } from "./owner-offline-code-client";
import { activateOwnerClaimantSessionAfterMfa, OWNER_SHEET_FLOW_LAUNCH_APPROVED, ownerSheetsOpen }
  from "./owner-sheet-launch";

vi.mock("expo-crypto", () => ({ randomUUID: () => "60000000-0000-4000-8000-000000000007" }));
vi.mock("@/shared/api/supabase-client", () => ({ createSupabaseClient: vi.fn() }));

const key = "4f3c2b1a-0000-4000-8000-000000000001";

function client(response: Response | (() => Promise<Response>)) {
  const fetchImpl = vi.fn(async () => (typeof response === "function" ? response() : response));
  return { fetchImpl, client: createOwnerOfflineCodeClient({ apiBaseUrl: "https://api.test/", ownerOrigin: "https://owner.test",
    getAccessToken: async () => "token", fetch: fetchImpl as unknown as typeof fetch }) };
}

describe("owner session activation (W2a)", () => {
  it("posts an empty body with the owner origin, token and idempotency key", async () => {
    const { client: owner, fetchImpl } = client(new Response(JSON.stringify({ session_version: 2, replayed: false })));
    await owner.activateSession(key);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.test/owner/session/activate", expect.objectContaining({
      method: "POST", body: "{}", headers: { Authorization: "Bearer token", "Content-Type": "application/json",
        "Idempotency-Key": key, Origin: "https://owner.test" } }));
  });

  it("maps a stale MFA to a step-up and rejects anything unexpected", async () => {
    await expect(client(new Response("{}", { status: 403 })).client.activateSession(key))
      .rejects.toMatchObject({ kind: "fresh_mfa_required" });
    for (const response of [new Response("{}", { status: 401 }),
      new Response(JSON.stringify({ session_version: 2, replayed: false, user_id: "x" })),
      new Response(JSON.stringify({ session_version: "2", replayed: false }))]) {
      await expect(client(response).client.activateSession(key)).rejects.toBeInstanceOf(OwnerOfflineCodeClientError);
    }
    await expect(client(new Response("{}")).client.activateSession("not-a-uuid")).rejects.toMatchObject({ kind: "failed" });
  });

  it("stays closed outside the Preview app, so sign-in never calls it", async () => {
    expect(OWNER_SHEET_FLOW_LAUNCH_APPROVED).toBe(false);
    expect(ownerSheetsOpen()).toBe(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await activateOwnerClaimantSessionAfterMfa();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
