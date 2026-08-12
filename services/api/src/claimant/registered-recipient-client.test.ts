import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRegisteredRecipientSupabaseClient } from "./registered-recipient-client.js";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

describe("registered-recipient Supabase client", () => {
  beforeEach(() => mockedCreateClient.mockReset());

  it("derives verified session assurance from the supplied bearer token", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "10000000-0000-4000-8000-000000000001" } },
      error: null,
    });
    const getClaims = vi.fn().mockResolvedValue({
      data: { claims: sessionClaims },
      error: null,
    });
    mockedCreateClient.mockReturnValue({ auth: { getClaims, getUser } } as never);

    const client = createRegisteredRecipientSupabaseClient(config);

    await expect(client.getSession("signed-session")).resolves.toEqual({
      aal: "aal2",
      amr: sessionClaims.amr,
      expiresAt: sessionClaims.exp,
      issuedAt: sessionClaims.iat,
      sessionId: sessionClaims.session_id,
      userId: sessionClaims.sub,
    });
    expect(getUser).toHaveBeenCalledWith("signed-session");
    expect(getClaims).toHaveBeenCalledWith("signed-session");
  });

  it("rejects mismatched subjects and authentication methods without timestamps", async () => {
    for (const claims of [
      { ...sessionClaims, sub: claimantUserId },
      { ...sessionClaims, amr: ["password", "mfa/totp"] },
    ]) {
      mockedCreateClient.mockReturnValue({
        auth: {
          getClaims: vi.fn().mockResolvedValue({ data: { claims }, error: null }),
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerUserId } }, error: null }),
        },
      } as never);
      await expect(
        createRegisteredRecipientSupabaseClient(config).getSession("signed-session"),
      ).rejects.toThrow("Unauthorized");
    }
  });

  it("maps server-derived owner identity into invitation RPC arguments", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { invitation_id: invitationId, invitation_version: 1, replayed: false },
      error: null,
    });
    mockedCreateClient.mockReturnValue({ auth: {}, rpc } as never);
    const client = createRegisteredRecipientSupabaseClient(config);

    await expect(client.issueInvitation({
      expiresAt: "2026-08-05T12:00:00.000Z",
      idempotencyKey,
      ownerUserId,
      recipientAddressDigest: digest,
    })).resolves.toEqual({ invitationId, invitationVersion: 1, replayed: false });

    expect(rpc).toHaveBeenCalledWith("claimant_issue_registered_invitation", {
      p_expires_at: "2026-08-05T12:00:00.000Z",
      p_idempotency_key: idempotencyKey,
      p_owner_user_id: ownerUserId,
      p_recipient_address_digest: digest,
    });
  });

  it("maps server-derived claimant identity and public-only key into acceptance RPC arguments", async () => {
    const keyId = "60000000-0000-4000-8000-000000000006";
    const rpc = vi.fn().mockResolvedValue({
      data: {
        case_id: caseId,
        case_version: 1,
        claimant_key_id: keyId,
        invitation_id: invitationId,
        invitation_version: 2,
        replayed: false,
      },
      error: null,
    });
    mockedCreateClient.mockReturnValue({ auth: {}, rpc } as never);
    const client = createRegisteredRecipientSupabaseClient(config);

    await expect(client.acceptInvitation({
      claimantUserId,
      deviceBindingDigest: digest,
      expectedInvitationVersion: 1,
      idempotencyKey,
      invitationId,
      policyPackId: "death-only-v1",
      policyPackVersion: 1,
      publicKeyJwk,
      recipientAddressDigest: digest,
    })).resolves.toEqual({
      caseId,
      caseVersion: 1,
      claimantKeyId: keyId,
      invitationId,
      invitationVersion: 2,
      replayed: false,
    });

    expect(rpc).toHaveBeenCalledWith("claimant_accept_registered_invitation", {
      p_claimant_user_id: claimantUserId,
      p_device_binding_digest: digest,
      p_expected_invitation_version: 1,
      p_idempotency_key: idempotencyKey,
      p_invitation_id: invitationId,
      p_policy_pack_id: "death-only-v1",
      p_policy_pack_version: 1,
      p_public_key_jwk: publicKeyJwk,
      p_recipient_address_digest: digest,
    });
  });

  it("maps activation, active-session assertion, and revocation to service RPCs", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: { displaced_previous: true, replayed: false, session_version: 2 },
        error: null,
      })
      .mockResolvedValueOnce({ data: { session_version: 2 }, error: null })
      .mockResolvedValueOnce({
        data: { replayed: false, revoked: true, session_version: 3 },
        error: null,
      });
    mockedCreateClient.mockReturnValue({ auth: {}, rpc } as never);
    const client = createRegisteredRecipientSupabaseClient(config);
    const sessionId = sessionClaims.session_id;

    await expect(client.activateSession({
      authenticatedAt: "2026-08-04T12:00:00.000Z",
      idempotencyKey,
      sessionId,
      userId: ownerUserId,
    })).resolves.toEqual({ displacedPrevious: true, replayed: false, sessionVersion: 2 });
    await expect(client.assertActiveSession(ownerUserId, sessionId)).resolves.toBeUndefined();
    await expect(client.revokeSession({
      idempotencyKey,
      sessionId,
      userId: ownerUserId,
    })).resolves.toEqual({ replayed: false, revoked: true, sessionVersion: 3 });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "claimant_activate_session",
      "claimant_assert_active_session",
      "claimant_revoke_session",
    ]);
  });

  it("maps lifecycle and invitation revocation only to service-owned RPC arguments", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: {
        action: "revoke", binding_version: 3, case_id: caseId, case_version: 4,
        finalization_version: 1, replayed: false,
      }, error: null })
      .mockResolvedValueOnce({ data: {
        invitation_id: invitationId, invitation_version: 2, replayed: false, revoked: true,
      }, error: null });
    mockedCreateClient.mockReturnValue({ auth: {}, rpc } as never);
    const client = createRegisteredRecipientSupabaseClient(config);

    await client.manageLifecycle({ action: "revoke", actorUserId: claimantUserId,
      caseId, deviceBindingDigest: null, expectedCaseVersion: 3, grants: null,
      idempotencyKey, publicKeyJwk: null, targetKeyId: ownerUserId });
    await client.revokeInvitation({ expectedVersion: 1, idempotencyKey,
      invitationId, ownerUserId });

    expect(rpc.mock.calls[0]).toEqual(["claimant_manage_registered_recipient", {
      p_action: "revoke", p_actor_user_id: claimantUserId, p_case_id: caseId,
      p_device_binding_digest: null, p_expected_case_version: 3, p_grants: null,
      p_idempotency_key: idempotencyKey, p_public_key_jwk: null,
      p_target_key_id: ownerUserId,
    }]);
    expect(rpc.mock.calls[1][0]).toBe("claimant_revoke_registered_invitation");
  });
});

const config = { serviceRoleKey: "service-role", supabaseUrl: "http://localhost:54321" };
const ownerUserId = "10000000-0000-4000-8000-000000000001";
const claimantUserId = "20000000-0000-4000-8000-000000000002";
const invitationId = "30000000-0000-4000-8000-000000000003";
const caseId = "40000000-0000-4000-8000-000000000004";
const idempotencyKey = "50000000-0000-4000-8000-000000000005";
const digest = "a".repeat(64);
const publicKeyJwk = { crv: "P-256" as const, kty: "EC" as const, x: "x".repeat(43), y: "y".repeat(43) };
const sessionClaims = {
  aal: "aal2",
  amr: [{ method: "mfa/totp", timestamp: 1_785_852_000 }],
  exp: 1_785_855_600,
  iat: 1_785_852_000,
  session_id: "70000000-0000-4000-8000-000000000007",
  sub: ownerUserId,
};
