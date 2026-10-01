import { describe, expect, it, vi } from "vitest";

import { createOwnerOfflineCodeClient, OwnerOfflineCodeClientError } from "./owner-offline-code-client";
import { activateOwnerClaimantSession } from "./owner-sheet-launch";
import { createOwnerSheetListFlow } from "./owner-sheet-list-flow";
import { ownerSheetListView } from "./owner-sheet-list-view-model";
import { createOwnerSheetListHandle } from "./owner-sheet-runtime";

vi.mock("expo-print", () => ({ printAsync: vi.fn(), printToFileAsync: vi.fn() }));
vi.mock("expo-file-system", () => ({ Directory: class {}, File: class {}, Paths: {} }));
vi.mock("expo-sharing", () => ({ shareAsync: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "60000000-0000-4000-8000-000000000008" }));
vi.mock("@/features/vault", () => ({ useVaultSession: vi.fn() }));
vi.mock("@/shared/api/supabase-client", () => ({ createSupabaseClient: vi.fn() }));

const env = { EXPO_PUBLIC_API_URL: "https://api.test", EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN: "https://owner.test" };
const sheetId = "3f9a1c2b-0000-4000-8000-000000000001";
const sheet = { locator_record_id: sheetId, status: "active", issued_at: "2026-09-25T09:00:00.000Z",
  expires_at: "2027-09-25T09:00:00.000Z", revoked_at: null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

/*
 * A stand-in for Supabase Auth and the W1 owner routes with the hosted rules: the list needs AAL2 (else 403) and an
 * activated claimant session control for that session (else 401); activation needs AAL2. A verified TOTP code
 * replaces the session token, as supabase-js does.
 */
function ownerWorld(input: { factors?: { id: string; status: string }[]; code?: string } = {}) {
  const world = { token: "aal1-token", activated: new Set<string>(), requests: [] as string[] };
  const auth = {
    getSession: async () => ({ data: { session: { access_token: world.token, user: { id: "owner-1" } } } }),
    refreshSession: vi.fn(async () => undefined),
    mfa: {
      listFactors: async () => ({ data: { totp: input.factors ?? [{ id: "factor-1", status: "verified" }] } }),
      challenge: async () => ({ data: { id: "challenge-1" }, error: null }),
      verify: async ({ code, factorId }: { code: string; factorId: string }) => {
        if (factorId !== "factor-1" || code !== (input.code ?? "123456")) {
          return { data: null, error: { message: "Invalid TOTP code" } };
        }
        world.token = "aal2-token";
        return { data: {}, error: null };
      },
    },
  };
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const token = String((init.headers as Record<string, string>).Authorization).replace("Bearer ", "");
    const path = new URL(url).pathname;
    world.requests.push(`${init.method} ${path} ${token}`);
    if (path === "/owner/session/activate") {
      if (token !== "aal2-token") return json({ error: "Fresh multi-factor authentication required" }, 403);
      world.activated.add(token);
      return json({ session_version: 1, replayed: false });
    }
    if (token !== "aal2-token") return json({ error: "Fresh multi-factor authentication required" }, 403);
    if (!world.activated.has(token)) return json({ error: "Unauthorized" }, 401);
    return json({ sheets: [sheet] });
  });
  return { world, auth, fetch };
}

describe("owner sheet list client errors", () => {
  const client = (fetch: () => Promise<Response>) => createOwnerOfflineCodeClient({ apiBaseUrl: "https://api.test",
    ownerOrigin: "https://owner.test", getAccessToken: async () => "jwt", fetch: fetch as never });

  it("tells a missing step-up, a refused session and an unreachable API apart", async () => {
    await expect(client(async () => json({}, 403)).list()).rejects.toMatchObject({ kind: "fresh_mfa_required" });
    await expect(client(async () => json({}, 401)).list()).rejects.toMatchObject({ kind: "unauthorized" });
    await expect(client(async () => { throw new TypeError("Network request failed"); }).list())
      .rejects.toMatchObject({ kind: "unreachable" });
    await expect(client(async () => json({}, 503)).list()).rejects.toMatchObject({ kind: "failed" });
  });
});

describe("owner sheet list step-up", () => {
  const api = (error: OwnerOfflineCodeClientError | null) => ({
    list: vi.fn(async () => { if (error) throw error; return []; }),
  });

  it.each(["fresh_mfa_required", "unauthorized"] as const)("asks for a code on a %s list, then loads once more",
    async (kind) => {
      const client = api(new OwnerOfflineCodeClientError(kind));
      const verifyFreshMfa = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const flow = createOwnerSheetListFlow({ client, verifyFreshMfa });
      await flow.load();
      expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", sheets: [] });
      expect(ownerSheetListView(flow.getState())).toMatchObject({ showMfaField: true,
        body: expect.stringContaining("To see your sheets") });
      await flow.submitMfaCode("000000");
      expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
      client.list.mockResolvedValueOnce([]);
      await flow.submitMfaCode("123456");
      expect(flow.getState()).toMatchObject({ status: "ready", sheets: [] });
      expect(client.list).toHaveBeenCalledTimes(2);
    });

  it("reports a session that is still refused after the step-up instead of asking again", async () => {
    const client = api(new OwnerOfflineCodeClientError("unauthorized"));
    const flow = createOwnerSheetListFlow({ client, verifyFreshMfa: async () => true });
    await flow.load(); await flow.submitMfaCode("123456");
    expect(flow.getState()).toMatchObject({ status: "failed", loadFailure: "session" });
    expect(ownerSheetListView(flow.getState()).notice?.message).toContain("Sign out, sign in again");
  });

  it("says when the server cannot be reached, and when it fails", async () => {
    for (const [kind, failure, message] of [["unreachable", "unreachable", "couldn't be reached"],
      ["failed", "server", "couldn't return your sheets"]] as const) {
      const flow = createOwnerSheetListFlow({ client: api(new OwnerOfflineCodeClientError(kind)),
        verifyFreshMfa: vi.fn() });
      await flow.load();
      expect(flow.getState()).toMatchObject({ status: "failed", loadFailure: failure });
      expect(ownerSheetListView(flow.getState()).notice?.message).toContain(message);
    }
  });
});

describe("owner sheets after MFA (integration with the runtime handle)", () => {
  it("a password-only session gets a step-up; the code activates the AAL2 session and the sheets load", async () => {
    const { world, auth, fetch } = ownerWorld();
    const flow = createOwnerSheetListHandle({ approved: true, auth, env, fetch: fetch as never })!;
    await flow.load();
    expect(flow.getState().status).toBe("needs_fresh_mfa");
    await flow.submitMfaCode("123456");
    expect(flow.getState()).toMatchObject({ status: "ready", sheets: [{ locatorRecordId: sheetId }] });
    expect(world.requests).toEqual(["GET /owner/offline-code/v2/locators aal1-token",
      "POST /owner/session/activate aal2-token", "GET /owner/offline-code/v2/locators aal2-token"]);
    expect(auth.refreshSession).toHaveBeenCalledOnce();
  });

  it("an AAL2 session activated after sign-in loads straight away", async () => {
    const { world, auth, fetch } = ownerWorld();
    await auth.mfa.verify({ code: "123456", factorId: "factor-1" });
    await expect(activateOwnerClaimantSession({ auth, env, fetch: fetch as never,
      randomUUID: () => "60000000-0000-4000-8000-000000000009" })).resolves.toBe("activated");
    const flow = createOwnerSheetListHandle({ approved: true, auth, env, fetch: fetch as never })!;
    await flow.load();
    expect(flow.getState().status).toBe("ready");
    expect(world.requests[0]).toBe("POST /owner/session/activate aal2-token");
  });

  it("an owner without a verified factor cannot pass the step-up", async () => {
    const { world, auth, fetch } = ownerWorld({ factors: [{ id: "factor-1", status: "unverified" }] });
    const flow = createOwnerSheetListHandle({ approved: true, auth, env, fetch: fetch as never })!;
    await flow.load(); await flow.submitMfaCode("123456");
    expect(flow.getState()).toMatchObject({ status: "needs_fresh_mfa", mfaRejected: true });
    expect(world.requests).toHaveLength(1);
  });
});

describe("owner session activation after MFA", () => {
  it("uses the session token at request time, so the one the TOTP check just raised", async () => {
    const { world, auth, fetch } = ownerWorld();
    const activate = () => activateOwnerClaimantSession({ auth, env, fetch: fetch as never,
      randomUUID: () => "60000000-0000-4000-8000-000000000009" });
    await expect(activate()).resolves.toBe("failed");
    world.token = "aal2-token";
    await expect(activate()).resolves.toBe("activated");
    expect(world.requests).toEqual(["POST /owner/session/activate aal1-token",
      "POST /owner/session/activate aal2-token"]);
  });

  it("does nothing without a session or the public configuration", async () => {
    const fetch = vi.fn();
    for (const input of [{ auth: null, env }, { auth: ownerWorld().auth, env: {} }]) {
      await expect(activateOwnerClaimantSession({ ...input, fetch: fetch as never, randomUUID: () => "x" }))
        .resolves.toBe("not_configured");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
