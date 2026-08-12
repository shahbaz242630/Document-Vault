import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export type ClaimantApiSession = Readonly<{
  aal: "aal1" | "aal2";
  amr: readonly Readonly<{ method: string; timestamp: number }>[];
  expiresAt: number;
  issuedAt: number;
  sessionId: string;
  userId: string;
}>;

export type IssueRegisteredInvitationInput = Readonly<{
  expiresAt: string;
  idempotencyKey: string;
  ownerUserId: string;
  recipientAddressDigest: string;
}>;

export type AcceptRegisteredInvitationInput = Readonly<{
  claimantUserId: string;
  deviceBindingDigest: string;
  expectedInvitationVersion: number;
  idempotencyKey: string;
  invitationId: string;
  policyPackId: string;
  policyPackVersion: number;
  publicKeyJwk: Readonly<{ crv: "P-256"; kty: "EC"; x: string; y: string }>;
  recipientAddressDigest: string;
}>;

export type IssueRegisteredInvitationResult = Readonly<{
  invitationId: string;
  invitationVersion: number;
  replayed: boolean;
}>;

export type AcceptRegisteredInvitationResult = Readonly<{
  caseId: string;
  caseVersion: number;
  claimantKeyId: string;
  invitationId: string;
  invitationVersion: number;
  replayed: boolean;
}>;

export type RegisteredRecipientMutationResult =
  | IssueRegisteredInvitationResult
  | AcceptRegisteredInvitationResult;

export type RegisteredRecipientLifecycleAction = "enroll" | "replace" | "revoke" | "finalize";

export type RecipientGrantEnvelopeV2Input = Readonly<{
  aead: "xchacha20poly1305_ietf"; ciphertext: string; created_at: string;
  grant_id: string; grant_version: number; kdf: "hkdf_sha256";
  key_agreement: "p256_ecdh"; nonce: string; owner_ephemeral_public_key: string;
  profile: "registered_recipient_v2"; protocol: "sanduqkin:claim:recipient-grant:v2";
  recipient_id: string; recipient_key_id: string; recipient_key_version: number;
  revoked_at: null;
}>;

export type RegisteredRecipientClient = Readonly<{
  acceptInvitation: (
    input: AcceptRegisteredInvitationInput,
  ) => Promise<AcceptRegisteredInvitationResult>;
  activateSession: (input: Readonly<{
    authenticatedAt: string;
    idempotencyKey: string;
    sessionId: string;
    userId: string;
  }>) => Promise<Readonly<{ displacedPrevious: boolean; replayed: boolean; sessionVersion: number }>>;
  assertActiveSession: (userId: string, sessionId: string) => Promise<void>;
  getSession: (jwt: string) => Promise<ClaimantApiSession>;
  issueInvitation: (
    input: IssueRegisteredInvitationInput,
  ) => Promise<IssueRegisteredInvitationResult>;
  manageLifecycle: (input: Readonly<{
    action: RegisteredRecipientLifecycleAction; actorUserId: string; caseId: string;
    deviceBindingDigest: string | null; expectedCaseVersion: number;
    grants: readonly RecipientGrantEnvelopeV2Input[] | null; idempotencyKey: string;
    publicKeyJwk: AcceptRegisteredInvitationInput["publicKeyJwk"] | null;
    targetKeyId: string | null;
  }>) => Promise<Readonly<{
    action: RegisteredRecipientLifecycleAction; bindingVersion: number; caseId: string;
    caseVersion: number; claimantKeyId?: string; finalizationVersion: number; replayed: boolean;
  }>>;
  revokeInvitation: (input: Readonly<{
    expectedVersion: number; idempotencyKey: string; invitationId: string; ownerUserId: string;
  }>) => Promise<Readonly<{
    invitationId: string; invitationVersion: number; replayed: boolean; revoked: boolean;
  }>>;
  revokeSession: (input: Readonly<{
    idempotencyKey: string;
    sessionId: string;
    userId: string;
  }>) => Promise<Readonly<{ replayed: boolean; revoked: boolean; sessionVersion: number }>>;
}>;

export type RegisteredRecipientSupabaseConfig = Readonly<{
  serviceRoleKey: string;
  supabaseUrl: string;
}>;

type SupabaseRpcError = Readonly<{ code?: string; message?: string }>;

export class RegisteredRecipientMutationError extends Error {
  readonly code: string | undefined;

  constructor(error: SupabaseRpcError) {
    super("Registered-recipient mutation failed.");
    this.name = "RegisteredRecipientMutationError";
    this.code = error.code;
  }
}

export function createRegisteredRecipientSupabaseClient(
  config: RegisteredRecipientSupabaseConfig,
): RegisteredRecipientClient {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    async acceptInvitation(input) {
      const result = await supabase.rpc("claimant_accept_registered_invitation", {
        p_claimant_user_id: input.claimantUserId,
        p_device_binding_digest: input.deviceBindingDigest,
        p_expected_invitation_version: input.expectedInvitationVersion,
        p_idempotency_key: input.idempotencyKey,
        p_invitation_id: input.invitationId,
        p_policy_pack_id: input.policyPackId,
        p_policy_pack_version: input.policyPackVersion,
        p_public_key_jwk: input.publicKeyJwk,
        p_recipient_address_digest: input.recipientAddressDigest,
      });
      return readAcceptResult(result.data, result.error);
    },
    async activateSession(input) {
      const result = await supabase.rpc("claimant_activate_session", {
        p_authenticated_at: input.authenticatedAt,
        p_idempotency_key: input.idempotencyKey,
        p_session_id: input.sessionId,
        p_user_id: input.userId,
      });
      return readSessionActivationResult(result.data, result.error);
    },
    async assertActiveSession(userId, sessionId) {
      const result = await supabase.rpc("claimant_assert_active_session", {
        p_session_id: sessionId,
        p_user_id: userId,
      });
      if (result.error) throw new RegisteredRecipientMutationError(result.error);
      sessionAssertionSchema.parse(result.data);
    },
    async getSession(jwt) {
      const [userResult, claimsResult] = await Promise.all([
        supabase.auth.getUser(jwt),
        supabase.auth.getClaims(jwt),
      ]);
      const userId = userResult.data.user?.id;
      const claims = sessionClaimsSchema.safeParse(claimsResult.data?.claims);
      if (userResult.error || claimsResult.error || !userId || !claims.success) {
        throw new Error("Unauthorized");
      }
      if (claims.data.sub !== userId) throw new Error("Unauthorized");
      return {
        aal: claims.data.aal,
        amr: claims.data.amr,
        expiresAt: claims.data.exp,
        issuedAt: claims.data.iat,
        sessionId: claims.data.session_id,
        userId,
      };
    },
    async issueInvitation(input) {
      const result = await supabase.rpc("claimant_issue_registered_invitation", {
        p_expires_at: input.expiresAt,
        p_idempotency_key: input.idempotencyKey,
        p_owner_user_id: input.ownerUserId,
        p_recipient_address_digest: input.recipientAddressDigest,
      });
      return readIssueResult(result.data, result.error);
    },
    async manageLifecycle(input) {
      const result = await supabase.rpc("claimant_manage_registered_recipient", {
        p_action: input.action, p_actor_user_id: input.actorUserId, p_case_id: input.caseId,
        p_device_binding_digest: input.deviceBindingDigest,
        p_expected_case_version: input.expectedCaseVersion, p_grants: input.grants,
        p_idempotency_key: input.idempotencyKey, p_public_key_jwk: input.publicKeyJwk,
        p_target_key_id: input.targetKeyId,
      });
      return readLifecycleResult(result.data, result.error);
    },
    async revokeInvitation(input) {
      const result = await supabase.rpc("claimant_revoke_registered_invitation", {
        p_expected_version: input.expectedVersion, p_idempotency_key: input.idempotencyKey,
        p_invitation_id: input.invitationId, p_owner_user_id: input.ownerUserId,
      });
      return readInvitationRevocationResult(result.data, result.error);
    },
    async revokeSession(input) {
      const result = await supabase.rpc("claimant_revoke_session", {
        p_idempotency_key: input.idempotencyKey,
        p_session_id: input.sessionId,
        p_user_id: input.userId,
      });
      return readSessionRevocationResult(result.data, result.error);
    },
  };
}

const sessionClaimsSchema = z.object({
  aal: z.enum(["aal1", "aal2"]),
  amr: z.array(z.object({ method: z.string(), timestamp: z.number().int().nonnegative() })),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  session_id: z.string().uuid(),
  sub: z.string().uuid(),
});

const sessionAssertionSchema = z.object({ session_version: z.number().int().positive() });
const sessionActivationResultSchema = z.strictObject({
  displaced_previous: z.boolean(),
  replayed: z.boolean(),
  session_version: z.number().int().positive(),
});
const sessionRevocationResultSchema = z.strictObject({
  replayed: z.boolean(),
  revoked: z.boolean(),
  session_version: z.number().int().positive(),
});
const lifecycleResultSchema = z.strictObject({
  action: z.enum(["enroll", "replace", "revoke", "finalize"]),
  binding_version: z.number().int().positive(), case_id: z.string().uuid(),
  case_version: z.number().int().positive(), claimant_key_id: z.string().uuid().optional(),
  finalization_version: z.number().int().nonnegative(), replayed: z.boolean(),
});
const invitationRevocationResultSchema = z.strictObject({
  invitation_id: z.string().uuid(), invitation_version: z.number().int().positive(),
  replayed: z.boolean(), revoked: z.boolean(),
});

const issueResultSchema = z.strictObject({
  invitation_id: z.string().uuid(),
  invitation_version: z.number().int().positive(),
  replayed: z.boolean(),
});

const acceptResultSchema = z.strictObject({
  case_id: z.string().uuid(),
  case_version: z.number().int().positive(),
  claimant_key_id: z.string().uuid(),
  invitation_id: z.string().uuid(),
  invitation_version: z.number().int().positive(),
  replayed: z.boolean(),
});

function readIssueResult(
  data: unknown,
  error: SupabaseRpcError | null,
): IssueRegisteredInvitationResult {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = issueResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Registered-recipient mutation returned an invalid result.");
  }
  return {
    invitationId: parsed.data.invitation_id,
    invitationVersion: parsed.data.invitation_version,
    replayed: parsed.data.replayed,
  };
}

function readAcceptResult(
  data: unknown,
  error: SupabaseRpcError | null,
): AcceptRegisteredInvitationResult {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = acceptResultSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Registered-recipient mutation returned an invalid result.");
  }
  return {
    caseId: parsed.data.case_id,
    caseVersion: parsed.data.case_version,
    claimantKeyId: parsed.data.claimant_key_id,
    invitationId: parsed.data.invitation_id,
    invitationVersion: parsed.data.invitation_version,
    replayed: parsed.data.replayed,
  };
}

function readSessionActivationResult(data: unknown, error: SupabaseRpcError | null) {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = sessionActivationResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Session activation returned an invalid result.");
  return {
    displacedPrevious: parsed.data.displaced_previous,
    replayed: parsed.data.replayed,
    sessionVersion: parsed.data.session_version,
  };
}

function readSessionRevocationResult(data: unknown, error: SupabaseRpcError | null) {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = sessionRevocationResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Session revocation returned an invalid result.");
  return {
    replayed: parsed.data.replayed,
    revoked: parsed.data.revoked,
    sessionVersion: parsed.data.session_version,
  };
}

function readLifecycleResult(data: unknown, error: SupabaseRpcError | null) {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = lifecycleResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Recipient lifecycle returned an invalid result.");
  return {
    action: parsed.data.action, bindingVersion: parsed.data.binding_version,
    caseId: parsed.data.case_id, caseVersion: parsed.data.case_version,
    ...(parsed.data.claimant_key_id ? { claimantKeyId: parsed.data.claimant_key_id } : {}),
    finalizationVersion: parsed.data.finalization_version, replayed: parsed.data.replayed,
  };
}

function readInvitationRevocationResult(data: unknown, error: SupabaseRpcError | null) {
  if (error) throw new RegisteredRecipientMutationError(error);
  const parsed = invitationRevocationResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invitation revocation returned an invalid result.");
  return {
    invitationId: parsed.data.invitation_id, invitationVersion: parsed.data.invitation_version,
    replayed: parsed.data.replayed, revoked: parsed.data.revoked,
  };
}
