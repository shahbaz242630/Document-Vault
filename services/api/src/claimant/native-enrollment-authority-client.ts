import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ClaimantApiSession, RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";

export type ConfirmedClaimantSessionV1 = ClaimantApiSession & Readonly<{
  confirmedAddress: string;
}>;
export type NativeEnrollmentRateActionV1 =
  | "registration_issue" | "registration_complete" | "native_issue" | "native_complete" | "native_reconcile";

export type NativeEnrollmentAuthorityClientV1 = Readonly<{
  getAuthority: (input: Readonly<{
    appAttestKeyIdDigest: string; claimantUserId: string; invitationId: string;
    portalSessionId: string; recipientAddressDigest: string;
  }>) => Promise<Readonly<{
    eligibilityVersion: number; invitationId: string; invitationVersion: number;
    recipientAddressDigest: string;
  }>>;
  getConfirmedSession: (jwt: string) => Promise<ConfirmedClaimantSessionV1>;
  takeRateLimit: (input: Readonly<{
    action: NativeEnrollmentRateActionV1; claimantUserId: string; portalSessionId: string;
  }>) => Promise<Readonly<{ allowed: true; remaining: number; retryAfterSeconds: number }>>;
}>;

export class NativeEnrollmentAuthorityError extends Error {
  readonly code: string | undefined;
  constructor(code: string | undefined) {
    super("Native enrollment authority failed."); this.name = "NativeEnrollmentAuthorityError"; this.code = code;
  }
}

export function createNativeEnrollmentAuthorityClientV1(
  config: RegisteredRecipientSupabaseConfig,
): NativeEnrollmentAuthorityClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return {
    async getAuthority(input) {
      const result = await supabase.rpc("claimant_get_native_enrollment_authority", {
        p_app_attest_key_id_digest: input.appAttestKeyIdDigest,
        p_claimant_user_id: input.claimantUserId, p_invitation_id: input.invitationId,
        p_portal_session_id: input.portalSessionId,
        p_recipient_address_digest: input.recipientAddressDigest,
      });
      return readAuthority(result.data, result.error);
    },
    async getConfirmedSession(jwt) {
      const [userResult, claimsResult] = await Promise.all([
        supabase.auth.getUser(jwt), supabase.auth.getClaims(jwt),
      ]);
      const user = userResult.data.user; const claims = sessionClaimsSchema.safeParse(claimsResult.data?.claims);
      if (userResult.error || claimsResult.error || !user?.id || !user.email || !user.email_confirmed_at ||
          !claims.success || claims.data.sub !== user.id) throw new Error("Unauthorized");
      return { aal: claims.data.aal, amr: claims.data.amr, confirmedAddress: user.email,
        expiresAt: claims.data.exp, issuedAt: claims.data.iat, sessionId: claims.data.session_id, userId: user.id };
    },
    async takeRateLimit(input) {
      const result = await supabase.rpc("claimant_take_native_enrollment_rate_limit", {
        p_action: input.action, p_claimant_user_id: input.claimantUserId,
        p_portal_session_id: input.portalSessionId,
      });
      return readRateLimit(result.data, result.error);
    },
  };
}

const sessionClaimsSchema = z.object({ aal: z.enum(["aal1", "aal2"]),
  amr: z.array(z.object({ method: z.string(), timestamp: z.number().int().nonnegative() })),
  exp: z.number().int().positive(), iat: z.number().int().positive(),
  session_id: z.string().uuid(), sub: z.string().uuid() });
const authoritySchema = z.strictObject({ eligibility_version: z.number().int().positive(),
  invitation_id: z.string().uuid(), invitation_version: z.number().int().positive(),
  recipient_address_digest: z.string().regex(/^[0-9a-f]{64}$/) });
const rateSchema = z.strictObject({ allowed: z.literal(true), remaining: z.number().int().nonnegative(),
  retry_after_seconds: z.number().int().positive().max(900) });
type RpcError = Readonly<{ code?: string }> | null;

function readAuthority(data: unknown, error: RpcError) {
  if (error) throw new NativeEnrollmentAuthorityError(error.code);
  const value = authoritySchema.safeParse(data); if (!value.success) throw new Error("Native enrollment authority returned an invalid result.");
  return { eligibilityVersion: value.data.eligibility_version, invitationId: value.data.invitation_id,
    invitationVersion: value.data.invitation_version, recipientAddressDigest: value.data.recipient_address_digest };
}
function readRateLimit(data: unknown, error: RpcError) {
  if (error) throw new NativeEnrollmentAuthorityError(error.code);
  const value = rateSchema.safeParse(data); if (!value.success) throw new Error("Native enrollment rate limit returned an invalid result.");
  return { allowed: value.data.allowed, remaining: value.data.remaining,
    retryAfterSeconds: value.data.retry_after_seconds };
}
