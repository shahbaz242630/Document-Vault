import type { Context } from "hono";
import { z } from "zod";

import {
  assertAppAttestAssertionResponseV1,
  assertAppAttestRegistrationResponseV1,
  assertNativeEnrollmentChallengeRequestV1,
  assertNativeEnrollmentPossessionProofV1,
  type AppAttestEnvironmentV1,
  type AppAttestValidationCategoryV1,
} from "@vault/shared-types";

import { isRequestBodyTooLarge, readBearerToken } from "../security/http.js";
import { createPinnedAppleAppAttestTrustV1 } from "./app-attest-certificate-trust.js";
import type { AppAttestCertificateTrustV1 } from "./app-attest-verifier.js";
import {
  createNativeEnrollmentAuthorityClientV1,
  NativeEnrollmentAuthorityError,
  type NativeEnrollmentAuthorityClientV1,
} from "./native-enrollment-authority-client.js";
import {
  deriveConfirmedRecipientAddressDigestV1,
  deriveControllerAppAttestKeyIdDigestV1,
  deriveControllerDeviceBindingDigestV1,
} from "./native-enrollment-controller-bindings.js";
import {
  createAppAttestRegistrationChallengeMaterialV1,
  createNativeEnrollmentChallengeMaterialV1,
} from "./native-enrollment-challenge-factory.js";
import { completeAppAttestRegistrationV1, completeNativeEnrollmentV1 } from "./native-enrollment-service.js";
import {
  createNativeEnrollmentSupabaseTransactionClientV1,
  NativeEnrollmentTransactionError,
  type NativeEnrollmentTransactionClientV1,
} from "./native-enrollment-transaction-client.js";
import { createServerEphemeralKeyCustodyV1, type ServerEphemeralKeyCustodyV1 } from "./server-ephemeral-key-custody.js";
import type { RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";
import {
  ClaimantCapabilityDisabledError, getClaimantRuntimeConfig,
  requireClaimantCapability, type ClaimantRuntimeConfig,
} from "./runtime-config.js";

export const CLAIMANT_NATIVE_ENROLLMENT_ROUTE_APPROVED = false as const;

const MAX_BODY_BYTES = 100_000;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const base64Url32 = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
const appAttestKeyId = z.string().regex(/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/);
const opaqueAppleObject = z.string().min(24).max(100_000)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const issueRegistrationSchema = z.strictObject({ app_attest_key_id: appAttestKeyId });
const registrationResponseSchema = z.strictObject({ app_attest_key_id: appAttestKeyId,
  attestation_object: opaqueAppleObject, challenge_id: uuid,
  protocol: z.literal("sanduqkin:claim:native-enrollment:app-attest-registration:v1") });
const capabilitySchema = z.strictObject({ claimed_hardware_security_level: z.literal("secure_enclave"),
  claimed_private_key_exportable: z.literal(false), claimed_user_presence_binding: z.literal("transaction_bound"),
  key_algorithm: z.literal("p256_ecdh"), platform: z.literal("ios"),
  protocol: z.literal("sanduqkin:claim:native-enrollment:v1"), public_key_encoding: z.literal("ansi_x9_63_uncompressed") });
const issueNativeSchema = z.strictObject({ app_attest_key_id: appAttestKeyId, capability: capabilitySchema,
  invitation_reference: uuid, protocol: z.literal("sanduqkin:claim:native-enrollment:v1"),
  public_key: z.string().regex(/^B[A-P][A-Za-z0-9_-]{84}[AEIMQUYcgkosw048]$/) });
const assertionResponseSchema = z.strictObject({ app_attest_key_id: appAttestKeyId,
  assertion_object: opaqueAppleObject.max(12_000), challenge_id: uuid,
  protocol: z.literal("sanduqkin:claim:native-enrollment:app-attest-assertion:v1") });
const possessionSchema = z.strictObject({ challenge_id: uuid, claimant_id: uuid,
  claimant_key_id: uuid, claimant_key_version: z.number().int().positive(),
  device_binding_digest: z.string().regex(/^[0-9a-f]{64}$/), invitation_reference: uuid,
  proof_mac: base64Url32,
  protocol: z.literal("sanduqkin:claim:native-enrollment:v1"),
  public_key_fingerprint: base64Url32 });
const completeNativeSchema = z.strictObject({ app_attest_challenge_id: uuid,
  app_attest_response: assertionResponseSchema, possession_proof: possessionSchema });
const reconcileNativeSchema = z.strictObject({ app_attest_challenge_id: uuid, native_challenge_id: uuid });

export type NativeEnrollmentRouteConfigV1 = RegisteredRecipientSupabaseConfig & Readonly<{
  addressIndexKey: Uint8Array;
  allowedOrigins: readonly string[];
  apiAudience: string;
  appIdHash: string;
  appAttestEnvironment: AppAttestEnvironmentV1;
  appleRootCertificateDer: Uint8Array;
  deviceBindingKey: Uint8Array;
  freshAssuranceSeconds: number;
  policyPackId: string;
  policyPackVersion: number;
  requiredBundleVersion: string;
  requiredValidationCategory: AppAttestValidationCategoryV1;
  serverEphemeralMasterKey: Uint8Array;
}>;

type NativeRouteDeps = Readonly<{
  createAuthority?: (config: RegisteredRecipientSupabaseConfig) => NativeEnrollmentAuthorityClientV1;
  createTransactions?: (config: RegisteredRecipientSupabaseConfig) => NativeEnrollmentTransactionClientV1;
  getConfig?: () => NativeEnrollmentRouteConfigV1 | null;
  now?: () => Date;
  routeApproved?: boolean;
  runtimeConfig?: ClaimantRuntimeConfig;
  trust?: AppAttestCertificateTrustV1;
  custody?: ServerEphemeralKeyCustodyV1;
}>;

export type NativeEnrollmentRouteAction =
  | "registrationIssue" | "registrationComplete" | "nativeIssue" | "nativeComplete" | "reconcile";

export function createNativeEnrollmentRouteV1(action: NativeEnrollmentRouteAction, deps: NativeRouteDeps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, deps);
    if (prepared instanceof Response) return prepared;
    const body = await readJson(context);
    if (body.kind === "tooLarge") return context.json({ error: "Payload too large" }, 413);
    if (body.kind === "invalid") return context.json({ error: "Invalid request" }, 400);
    try {
      const session = await prepared.authority.getConfirmedSession(prepared.jwt);
      requireFreshClaimantAssurance(session, Math.floor((deps.now?.() ?? new Date()).getTime() / 1000), prepared.config.freshAssuranceSeconds);
      const rateAction = ({ registrationIssue: "registration_issue", registrationComplete: "registration_complete",
        nativeIssue: "native_issue", nativeComplete: "native_complete", reconcile: "native_reconcile" } as const)[action];
      await prepared.authority.takeRateLimit({ action: rateAction,
        claimantUserId: session.userId, portalSessionId: session.sessionId });
      return action === "reconcile"
        ? reconcileNative(context, body.value, session, prepared)
        : action === "registrationIssue"
        ? issueRegistration(context, body.value, session, prepared, deps)
        : action === "registrationComplete"
          ? completeRegistration(context, body.value, session, prepared, deps)
          : action === "nativeIssue"
            ? issueNative(context, body.value, session, prepared, deps)
            : completeNative(context, body.value, session, prepared, deps);
    } catch (error) { return routeError(context, error); }
  };
}

async function reconcileNative(context: Context, body: unknown, session: Session, prepared: Prepared) {
  const parsed = reconcileNativeSchema.safeParse(body); if (!parsed.success) return invalid(context);
  const attemptId = uuid.safeParse(context.req.param("attemptId"));
  if (!attemptId.success || attemptId.data !== prepared.idempotencyKey) return invalid(context);
  const result = await prepared.transactions.reconcileNativeEnrollment({
    appAttestChallengeId: parsed.data.app_attest_challenge_id, attemptId: attemptId.data,
    claimantUserId: session.userId, nativeChallengeId: parsed.data.native_challenge_id,
    portalSessionId: session.sessionId,
  });
  return context.json({ result }, 200);
}

export function createNativeEnrollmentPreflightRouteV1(deps: NativeRouteDeps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    const origin = context.req.header("Origin");
    if (!origin || !config.allowedOrigins.includes(origin)) return context.json({ error: "Forbidden" }, 403);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean);
    const allowed = new Set(["authorization", "content-type", "idempotency-key"]);
    if (method !== "POST" || !headers?.length || !headers.every((value) => allowed.has(value))) {
      return context.json({ error: "Forbidden" }, 403);
    }
    setHeaders(context, origin); context.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST"); context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

async function issueRegistration(context: Context, body: unknown, session: Session, prepared: Prepared, deps: NativeRouteDeps) {
  const parsed = issueRegistrationSchema.safeParse(body); if (!parsed.success) return invalid(context);
  const material = createAppAttestRegistrationChallengeMaterialV1({
    apiAudience: prepared.config.apiAudience,
    appAttestKeyIdDigest: deriveControllerAppAttestKeyIdDigestV1(parsed.data.app_attest_key_id),
    appIdHash: prepared.config.appIdHash, claimantUserId: session.userId,
    environment: prepared.config.appAttestEnvironment, portalSessionId: session.sessionId,
    requiredBundleVersion: prepared.config.requiredBundleVersion,
    requiredValidationCategory: prepared.config.requiredValidationCategory,
  }, { now: deps.now });
  await prepared.transactions.issueRegistrationChallenge({ claimantUserId: session.userId,
    idempotencyKey: prepared.idempotencyKey, material, portalSessionId: session.sessionId });
  return context.json({ result: { challenge: material.challenge,
    challenge_bytes: material.challengeBytesBase64Url } }, 200);
}

async function completeRegistration(context: Context, body: unknown, session: Session, prepared: Prepared, deps: NativeRouteDeps) {
  const parsed = registrationResponseSchema.safeParse(body); if (!parsed.success) return invalid(context);
  const response = assertAppAttestRegistrationResponseV1(parsed.data);
  const challengeId = context.req.param("challengeId");
  if (!uuid.safeParse(challengeId).success || response.challenge_id !== challengeId) return invalid(context);
  const result = await completeAppAttestRegistrationV1({ challengeId,
    claimantUserId: session.userId, idempotencyKey: prepared.idempotencyKey,
    now: deps.now?.(), portalSessionId: session.sessionId, response,
    transactions: prepared.transactions, trust: prepared.trust });
  return context.json({ result }, 200);
}

async function issueNative(context: Context, body: unknown, session: Session, prepared: Prepared, deps: NativeRouteDeps) {
  const parsed = issueNativeSchema.safeParse(body); if (!parsed.success) return invalid(context);
  const request = assertNativeEnrollmentChallengeRequestV1({ capability: parsed.data.capability,
    invitation_reference: parsed.data.invitation_reference, policy_pack_id: prepared.config.policyPackId,
    policy_pack_version: prepared.config.policyPackVersion, protocol: parsed.data.protocol,
    public_key: parsed.data.public_key });
  const keyDigest = deriveControllerAppAttestKeyIdDigestV1(parsed.data.app_attest_key_id);
  const addressDigest = deriveConfirmedRecipientAddressDigestV1(prepared.config.addressIndexKey, session.confirmedAddress);
  const authority = await prepared.authority.getAuthority({ appAttestKeyIdDigest: keyDigest,
    claimantUserId: session.userId, invitationId: request.invitation_reference,
    portalSessionId: session.sessionId, recipientAddressDigest: addressDigest });
  const material = createNativeEnrollmentChallengeMaterialV1({ apiAudience: prepared.config.apiAudience,
    appAttestKeyIdDigest: keyDigest, appIdHash: prepared.config.appIdHash,
    claimantPublicKeyBase64Url: request.public_key, claimantUserId: session.userId,
    custody: prepared.custody, deviceBindingDigest: deriveControllerDeviceBindingDigestV1(
      prepared.config.deviceBindingKey, session.userId, keyDigest),
    eligibilityVersion: authority.eligibilityVersion, environment: prepared.config.appAttestEnvironment,
    invitationId: authority.invitationId, invitationVersion: authority.invitationVersion,
    policyPackId: prepared.config.policyPackId, policyPackVersion: prepared.config.policyPackVersion,
    portalSessionId: session.sessionId, requiredBundleVersion: prepared.config.requiredBundleVersion,
    requiredValidationCategory: prepared.config.requiredValidationCategory,
  }, { now: deps.now });
  await prepared.transactions.issueNativeChallenge({ claimantUserId: session.userId,
    eligibilityVersion: authority.eligibilityVersion, idempotencyKey: prepared.idempotencyKey,
    invitationId: authority.invitationId, invitationVersion: authority.invitationVersion,
    material, portalSessionId: session.sessionId, recipientAddressDigest: authority.recipientAddressDigest });
  return context.json({ result: { app_attest_challenge: material.appAttestChallenge,
    app_attest_challenge_bytes: material.appAttestChallengeBytesBase64Url,
    native_challenge: material.nativeChallenge,
    native_challenge_bytes: material.nativeChallengeBytesBase64Url } }, 200);
}

async function completeNative(context: Context, body: unknown, session: Session, prepared: Prepared, deps: NativeRouteDeps) {
  const parsed = completeNativeSchema.safeParse(body); if (!parsed.success) return invalid(context);
  const appResponse = assertAppAttestAssertionResponseV1(parsed.data.app_attest_response);
  const proof = assertNativeEnrollmentPossessionProofV1(parsed.data.possession_proof);
  const nativeChallengeId = context.req.param("nativeChallengeId");
  if (!uuid.safeParse(nativeChallengeId).success || proof.challenge_id !== nativeChallengeId) return invalid(context);
  const result = await completeNativeEnrollmentV1({ appAttestChallengeId: parsed.data.app_attest_challenge_id,
    appAttestResponse: appResponse, claimantUserId: session.userId, custody: prepared.custody,
    idempotencyKey: prepared.idempotencyKey, nativeChallengeId, now: deps.now?.(),
    portalSessionId: session.sessionId, possessionProof: proof, transactions: prepared.transactions });
  return context.json({ result }, 200);
}

type Session = Awaited<ReturnType<NativeEnrollmentAuthorityClientV1["getConfirmedSession"]>>;
type Prepared = Readonly<{ authority: NativeEnrollmentAuthorityClientV1; config: NativeEnrollmentRouteConfigV1;
  custody: ServerEphemeralKeyCustodyV1; idempotencyKey: string; jwt: string;
  transactions: NativeEnrollmentTransactionClientV1; trust: AppAttestCertificateTrustV1 }>;

function prepare(context: Context, deps: NativeRouteDeps): Prepared | Response {
  const config = requireConfig(context, deps); if (config instanceof Response) return config;
  const origin = context.req.header("Origin");
  if (!origin || !config.allowedOrigins.includes(origin)) return context.json({ error: "Forbidden" }, 403);
  setHeaders(context, origin);
  if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") return context.json({ error: "Unsupported media type" }, 415);
  if (isRequestBodyTooLarge(context, MAX_BODY_BYTES)) return context.json({ error: "Payload too large" }, 413);
  const jwt = readBearerToken(context.req.header("Authorization"));
  const idempotencyKey = uuid.safeParse(context.req.header("Idempotency-Key")?.trim());
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  if (!idempotencyKey.success) return invalid(context);
  const serviceConfig = { serviceRoleKey: config.serviceRoleKey, supabaseUrl: config.supabaseUrl };
  return { authority: (deps.createAuthority ?? createNativeEnrollmentAuthorityClientV1)(serviceConfig), config,
    custody: deps.custody ?? createServerEphemeralKeyCustodyV1(config.serverEphemeralMasterKey),
    idempotencyKey: idempotencyKey.data, jwt,
    transactions: (deps.createTransactions ?? createNativeEnrollmentSupabaseTransactionClientV1)(serviceConfig),
    trust: deps.trust ?? createPinnedAppleAppAttestTrustV1({ rootCertificateDer: config.appleRootCertificateDer }) };
}

function requireConfig(context: Context, deps: NativeRouteDeps): NativeEnrollmentRouteConfigV1 | Response {
  if (!(deps.routeApproved ?? CLAIMANT_NATIVE_ENROLLMENT_ROUTE_APPROVED)) return context.json({ error: "Not found" }, 404);
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "registeredRecipient"); }
  catch (error) { if (error instanceof ClaimantCapabilityDisabledError) return context.json({ error: "Not found" }, 404); throw error; }
  return (deps.getConfig ?? getNativeEnrollmentRouteConfigV1)() ?? context.json({ error: "Service unavailable" }, 503);
}

async function readJson(context: Context): Promise<
  | Readonly<{ kind: "valid"; value: unknown }>
  | Readonly<{ kind: "invalid" }>
  | Readonly<{ kind: "tooLarge" }>
> {
  try { const text = await context.req.text(); if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return { kind: "tooLarge" };
    return { kind: "valid", value: JSON.parse(text) }; } catch { return { kind: "invalid" }; }
}
function routeError(context: Context, error: unknown): Response {
  if (error instanceof ClaimantAssuranceError) return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  if (error instanceof NativeEnrollmentAuthorityError) {
    if (error.code === "P0001") { context.header("Retry-After", "900"); return context.json({ error: "Request could not be completed" }, 429); }
    if (error.code === "28000") return context.json({ error: "Unauthorized" }, 401);
    if (["40001", "42501"].includes(error.code ?? "")) return context.json({ error: "Not found" }, 404);
  }
  if (error instanceof NativeEnrollmentTransactionError && ["22023", "23505", "40001"].includes(error.code ?? "")) {
    return context.json({ error: "Request conflict" }, 409);
  }
  return context.json({ error: "Request could not be completed" }, 500);
}
function invalid(context: Context): Response { return context.json({ error: "Invalid request" }, 400); }
function setHeaders(context: Context, origin: string) { context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store"); context.header("Vary", "Origin"); context.header("X-Content-Type-Options", "nosniff"); }

function getNativeEnrollmentRouteConfigV1(): NativeEnrollmentRouteConfigV1 | null {
  const allowedOrigins = process.env.CLAIMANT_NATIVE_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
  const apiAudience = process.env.CLAIMANT_NATIVE_API_AUDIENCE?.trim();
  const appIdHash = process.env.CLAIMANT_APP_ATTEST_APP_ID_HASH?.trim();
  const environment = process.env.CLAIMANT_APP_ATTEST_ENVIRONMENT?.trim();
  const category = Number(process.env.CLAIMANT_APP_ATTEST_VALIDATION_CATEGORY?.trim());
  const bundle = process.env.CLAIMANT_APP_ATTEST_BUNDLE_VERSION?.trim();
  const policyPackId = process.env.CLAIMANT_NATIVE_POLICY_PACK_ID?.trim();
  const policyPackVersion = Number(process.env.CLAIMANT_NATIVE_POLICY_PACK_VERSION?.trim());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(); const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const freshAssuranceSeconds = Number(process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600");
  const addressIndexKey = decodeConfig(process.env.CLAIMANT_ADDRESS_INDEX_KEY_BASE64URL, 32);
  const deviceBindingKey = decodeConfig(process.env.CLAIMANT_DEVICE_BINDING_KEY_BASE64URL, 32);
  const serverEphemeralMasterKey = decodeConfig(process.env.CLAIMANT_SERVER_EPHEMERAL_MASTER_KEY_BASE64URL, 32);
  const appleRootCertificateDer = decodeConfig(process.env.CLAIMANT_APPLE_ROOT_CERT_DER_BASE64, undefined, "base64");
  if (!allowedOrigins?.length || !allowedOrigins.every(validHttpsOrigin) || !apiAudience || !validHttpsOrigin(apiAudience) ||
      !appIdHash || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u.test(appIdHash) ||
      !bundle || !/^[0-9]+(?:\.[0-9]+){0,2}$/u.test(bundle) ||
      !policyPackId || !/^[a-z0-9](?:[a-z0-9._:-]{0,198}[a-z0-9])?$/u.test(policyPackId) || !serviceRoleKey ||
      !supabaseUrl || !addressIndexKey || !deviceBindingKey || !serverEphemeralMasterKey || !appleRootCertificateDer ||
      appleRootCertificateDer.byteLength > 8_192 || !validHttpsOrigin(supabaseUrl) ||
      (environment !== "development" && environment !== "production") || ![2, 3, 4].includes(category) ||
      !Number.isInteger(policyPackVersion) || policyPackVersion < 1 || !Number.isInteger(freshAssuranceSeconds) ||
      freshAssuranceSeconds < 60 || freshAssuranceSeconds > 600) return null;
  return { addressIndexKey, allowedOrigins, apiAudience, appIdHash,
    appAttestEnvironment: environment, appleRootCertificateDer, deviceBindingKey,
    freshAssuranceSeconds, policyPackId, policyPackVersion, requiredBundleVersion: bundle,
    requiredValidationCategory: category as AppAttestValidationCategoryV1,
    serverEphemeralMasterKey, serviceRoleKey, supabaseUrl };
}

function decodeConfig(value: string | undefined, length?: number, encoding: "base64" | "base64url" = "base64url") {
  if (!value) return null; const decoded = Buffer.from(value, encoding);
  if ((length !== undefined && decoded.byteLength !== length) || decoded.byteLength === 0 ||
      decoded.toString(encoding) !== value) return null;
  return new Uint8Array(decoded);
}

function validHttpsOrigin(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === value && !url.username && !url.password; }
  catch { return false; }
}
