import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ClaimantApiSession, RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";

export type ClaimantPortalSessionClient = Readonly<{
  activate(input: PortalSessionMutationInput & Readonly<{ authenticatedAt: string }>): Promise<PortalSessionResult>;
  assert(userId: string, sessionId: string): Promise<PortalSessionResult>;
  getSession(jwt: string): Promise<ClaimantApiSession>;
  revoke(input: PortalSessionMutationInput): Promise<PortalSessionResult>;
}>;

type PortalSessionMutationInput = Readonly<{
  idempotencyKey: string;
  sessionId: string;
  userId: string;
}>;

export type PortalSessionResult = Readonly<{
  context: "claimant_portal";
  displacedPrevious?: boolean;
  replayed?: boolean;
  revoked?: boolean;
  sessionVersion: number;
}>;

type SupabaseRpcError = Readonly<{ code?: string; message?: string }>;

export class ClaimantPortalSessionError extends Error {
  readonly code: string | undefined;

  constructor(error: SupabaseRpcError) {
    super("Claimant portal session request failed.");
    this.name = "ClaimantPortalSessionError";
    this.code = error.code;
  }
}

export function createClaimantPortalSessionClient(
  config: RegisteredRecipientSupabaseConfig,
): ClaimantPortalSessionClient {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return {
    async activate(input) {
      const result = await supabase.rpc("claimant_activate_portal_session", {
        p_authenticated_at: input.authenticatedAt,
        p_idempotency_key: input.idempotencyKey,
        p_session_id: input.sessionId,
        p_user_id: input.userId,
      });
      return readPortalResult(result.data, result.error);
    },
    async assert(userId, sessionId) {
      const result = await supabase.rpc("claimant_assert_portal_session", {
        p_session_id: sessionId,
        p_user_id: userId,
      });
      return readPortalResult(result.data, result.error);
    },
    async getSession(jwt) {
      const [userResult, claimsResult] = await Promise.all([
        supabase.auth.getUser(jwt), supabase.auth.getClaims(jwt),
      ]);
      const userId = userResult.data.user?.id;
      const claims = sessionClaimsSchema.safeParse(claimsResult.data?.claims);
      if (userResult.error || claimsResult.error || !userId || !claims.success || claims.data.sub !== userId) {
        throw new Error("Unauthorized");
      }
      return {
        aal: claims.data.aal, amr: claims.data.amr, expiresAt: claims.data.exp,
        issuedAt: claims.data.iat, sessionId: claims.data.session_id, userId,
      };
    },
    async revoke(input) {
      const result = await supabase.rpc("claimant_revoke_portal_session", {
        p_idempotency_key: input.idempotencyKey,
        p_session_id: input.sessionId,
        p_user_id: input.userId,
      });
      return readPortalResult(result.data, result.error);
    },
  };
}

const sessionClaimsSchema = z.object({
  aal: z.enum(["aal1", "aal2"]),
  amr: z.array(z.object({ method: z.string(), timestamp: z.number().int().nonnegative() })),
  exp: z.number().int().positive(), iat: z.number().int().positive(),
  session_id: z.string().uuid(), sub: z.string().uuid(),
});

const portalResultSchema = z.strictObject({
  context: z.literal("claimant_portal"),
  displaced_previous: z.boolean().optional(), replayed: z.boolean().optional(),
  revoked: z.boolean().optional(), session_version: z.number().int().positive(),
});

function readPortalResult(data: unknown, error: SupabaseRpcError | null): PortalSessionResult {
  if (error) throw new ClaimantPortalSessionError(error);
  const parsed = portalResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Claimant portal session returned an invalid result.");
  return {
    context: parsed.data.context,
    ...(parsed.data.displaced_previous === undefined ? {} : { displacedPrevious: parsed.data.displaced_previous }),
    ...(parsed.data.replayed === undefined ? {} : { replayed: parsed.data.replayed }),
    ...(parsed.data.revoked === undefined ? {} : { revoked: parsed.data.revoked }),
    sessionVersion: parsed.data.session_version,
  };
}
