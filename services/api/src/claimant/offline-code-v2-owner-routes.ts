import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import {
  canonicalJsonBytes,
  normalizeOfflineCodePublicLocatorV2,
  OFFLINE_CODE_PROTOCOL_V2,
  OFFLINE_CODE_V2_LABELS,
  OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID,
} from "@vault/shared-types";
import type { Context } from "hono";
import { z } from "zod";

import { readBearerToken } from "../security/http.js";
import { offlineCodeV2BoundaryDigest } from "./offline-code-v2-locator-index.js";
import { createOfflineCodeV2OwnerSheetReader, createOfflineCodeV2PersistenceTransactionClient,
  OfflineCodeV2PersistenceTransactionError, type OfflineCodeV2OwnerSheetReader,
  type OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";
import { type ClaimantApiSession, createRegisteredRecipientSupabaseClient, RegisteredRecipientMutationError,
  type RegisteredRecipientClient, type RegisteredRecipientSupabaseConfig }
  from "./registered-recipient-client.js";
import { isClaimantPreviewActivated } from "./preview-activation.js";
import { ClaimantCapabilityDisabledError, getClaimantRuntimeConfig, requireClaimantCapability,
  type ClaimantRuntimeConfig } from "./runtime-config.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";

/*
 * Slice 6G: the owner registers and revokes an offline-code V2 emergency sheet. The owner ID comes only from a
 * fresh AAL2 owner session. Before any database call the server recomputes the locator commitment and the
 * record-binding digest with that owner ID, so a sheet built for another account cannot be registered. The
 * printed secret, the sheet payload and all key material are rejected by the strict body schema.
 */
export const CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED = false as const;

export type OfflineCodeV2OwnerAction = "register" | "revoke";
export type OfflineCodeV2OwnerRoutesConfig = RegisteredRecipientSupabaseConfig & Readonly<{
  apiOrigin: string; ownerOrigin: string; freshAssuranceSeconds: number; locatorIndexKey: string;
}>;
type Deps = Readonly<{
  approved?: boolean;
  createOwnerSessionClient?: (config: RegisteredRecipientSupabaseConfig) => RegisteredRecipientClient;
  createPersistence?: (config: OfflineCodeV2OwnerRoutesConfig) => OfflineCodeV2PersistenceTransactionClient;
  createSheetReader?: (config: OfflineCodeV2OwnerRoutesConfig) => OfflineCodeV2OwnerSheetReader;
  getConfig?: () => OfflineCodeV2OwnerRoutesConfig | null;
  now?: () => Date;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

const MAX_BODY_BYTES = 16_384;
const MAX_VALIDITY_MS = 365 * 86_400_000;
const CLOCK_SKEW_MS = 60_000;
const uuidV4 = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
);
const base64url32 = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u);
const canonicalTimestamp = z.string().max(40).refine((value) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
});
const registerSchema = z.strictObject({
  locatorRecordId: uuidV4, grantId: uuidV4, publicLocator: z.string().min(1).max(64),
  locatorCommitment: base64url32, proofPublicKey: base64url32, recordBindingDigest: base64url32,
  kdfSalt: z.string().regex(/^[A-Za-z0-9_-]{21}[AQgw]$/u),
  wrapNonce: z.string().regex(/^[A-Za-z0-9_-]{32}$/u),
  wrapCiphertext: z.string().regex(/^[A-Za-z0-9_-]{64}$/u),
  wrapAssociatedDataDigest: base64url32, issuedAt: canonicalTimestamp, expiresAt: canonicalTimestamp,
});
const revokeSchema = z.strictObject({});

export function createOfflineCodeV2OwnerRoute(action: OfflineCodeV2OwnerAction, deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, action, deps); if (prepared instanceof Response) return prepared;
    try {
      const session = await authenticate(prepared.ownerSession, prepared.jwt);
      requireFreshClaimantAssurance(session,
        Math.floor(now(deps).getTime() / 1000), prepared.config.freshAssuranceSeconds);
      await prepared.ownerSession.assertActiveSession(session.userId, session.sessionId);
      const body = await readJson(context, action); if (body instanceof Response) return body;
      const persistence = (deps.createPersistence ?? createPersistence)(prepared.config);
      if (action === "revoke") {
        const result = await persistence.revoke({ locatorRecordId: prepared.locatorRecordId!,
          ownerUserId: session.userId, expectedLocatorVersion: 2, reason: "owner_revoked",
          idempotencyKey: prepared.idempotencyKey });
        return context.json({ locator_record_id: result.locatorRecordId, status: result.status,
          replayed: result.replayed }, 200);
      }
      const registration = verifyRegistration(body as z.infer<typeof registerSchema>,
        session.userId, now(deps).getTime());
      if (!registration) return invalid(context);
      const result = await persistence.register({ ...registration.fields,
        ownerUserId: session.userId, idempotencyKey: prepared.idempotencyKey,
        locatorIndexDigest: offlineCodeV2BoundaryDigest(
          Buffer.from(prepared.config.locatorIndexKey, "base64url"), "locator", registration.normalizedLocator),
      });
      return context.json({ locator_record_id: result.locatorRecordId, status: result.status,
        replayed: result.replayed }, 200);
    } catch (error) { return routeError(context, error); }
  };
}

/*
 * Slice 6J: the owner's own sheets, dates and status only. Listing reveals no secret, so it needs an active AAL2
 * owner session without recovery but not a fresh MFA step-up; revoking still needs one.
 */
export function createOfflineCodeV2OwnerListRoute(deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!originsMatch(context, config)) return notFound(context);
    setHeaders(context, config.ownerOrigin);
    const jwt = readBearerToken(context.req.header("Authorization"));
    if (!jwt) return context.json({ error: "Unauthorized" }, 401);
    const declared = context.req.header("Content-Length")?.trim();
    if (declared && declared !== "0") return invalid(context);
    try {
      const ownerSession = (deps.createOwnerSessionClient ?? createRegisteredRecipientSupabaseClient)(config);
      const session = await authenticate(ownerSession, jwt);
      requireActiveOwnerAssurance(session, Math.floor(now(deps).getTime() / 1000));
      await ownerSession.assertActiveSession(session.userId, session.sessionId);
      const sheets = await (deps.createSheetReader ?? createSheetReader)(config).listOwnerSheets(session.userId);
      return context.json({ sheets: sheets.map((sheet) => ({ locator_record_id: sheet.locatorRecordId,
        status: sheet.status, issued_at: sheet.issuedAt, expires_at: sheet.expiresAt,
        revoked_at: sheet.revokedAt })) }, 200);
    } catch (error) { return routeError(context, error); }
  };
}

export function createOfflineCodeV2OwnerPreflightRoute(deps: Deps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!originsMatch(context, config)) return notFound(context);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = new Set(context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean));
    const listing = method === "GET" && context.req.param("locatorRecordId") === undefined;
    const allowed = new Set(listing ? ["authorization"] : ["authorization", "content-type", "idempotency-key"]);
    if ((method !== "POST" && !listing) || headers.size !== allowed.size
      || [...headers].some((value) => !allowed.has(value))) return notFound(context);
    setHeaders(context, config.ownerOrigin);
    context.header("Access-Control-Allow-Headers",
      listing ? "Authorization" : "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", listing ? "GET" : "POST");
    context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

type Prepared = Readonly<{ config: OfflineCodeV2OwnerRoutesConfig; idempotencyKey: string; jwt: string;
  locatorRecordId?: string; ownerSession: RegisteredRecipientClient }>;

function prepare(context: Context, action: OfflineCodeV2OwnerAction, deps: Deps): Prepared | Response {
  const config = requireConfig(context, deps); if (config instanceof Response) return config;
  if (!originsMatch(context, config)) return notFound(context);
  setHeaders(context, config.ownerOrigin);
  if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") {
    return context.json({ error: "Unsupported media type" }, 415);
  }
  const jwt = readBearerToken(context.req.header("Authorization"));
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  const idempotencyKey = uuidV4.safeParse(context.req.header("Idempotency-Key")?.trim());
  if (!idempotencyKey.success) return invalid(context);
  let locatorRecordId: string | undefined;
  if (action === "revoke") {
    const parsed = uuidV4.safeParse(context.req.param("locatorRecordId"));
    if (!parsed.success) return invalid(context);
    locatorRecordId = parsed.data;
  }
  const declared = context.req.header("Content-Length")?.trim();
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    return context.json({ error: "Payload too large" }, 413);
  }
  return { config, idempotencyKey: idempotencyKey.data, jwt, locatorRecordId,
    ownerSession: (deps.createOwnerSessionClient ?? createRegisteredRecipientSupabaseClient)(config) };
}

function verifyRegistration(body: z.infer<typeof registerSchema>, ownerUserId: string, nowMs: number) {
  let normalizedLocator: string;
  try { normalizedLocator = normalizeOfflineCodePublicLocatorV2(body.publicLocator); } catch { return null; }
  const issuedAt = Date.parse(body.issuedAt); const expiresAt = Date.parse(body.expiresAt);
  if (Math.abs(issuedAt - nowMs) > CLOCK_SKEW_MS || expiresAt <= issuedAt
    || expiresAt - issuedAt > MAX_VALIDITY_MS) return null;
  const locatorCommitment = sha256(canonicalJsonBytes({
    protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "public_locator_commitment",
    label: OFFLINE_CODE_V2_LABELS.locatorCommitment, locator_record_id: body.locatorRecordId,
    locator_version: 2, normalized_locator: normalizedLocator,
  }));
  if (locatorCommitment !== body.locatorCommitment) return null;
  const recordBinding = {
    protocol: OFFLINE_CODE_PROTOCOL_V2, purpose: "record_binding", locator_record_id: body.locatorRecordId,
    locator_version: 2, locator_commitment: body.locatorCommitment, grant_id: body.grantId,
    owner_id: ownerUserId, kdf_profile_id: OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID, proof_key_version: 1,
    proof_public_key: body.proofPublicKey,
  };
  const label = new TextEncoder().encode(OFFLINE_CODE_V2_LABELS.recordBinding);
  const recordBindingDigest = sha256(Buffer.concat([label, Buffer.of(0), canonicalJsonBytes(recordBinding)]));
  if (recordBindingDigest !== body.recordBindingDigest) return null;
  const { publicLocator: _publicLocator, ...fields } = body;
  return { fields, normalizedLocator };
}

async function authenticate(client: RegisteredRecipientClient, jwt: string) {
  try { return await client.getSession(jwt); } catch { throw new AuthenticationError(); }
}

async function readJson(context: Context, action: OfflineCodeV2OwnerAction): Promise<unknown> {
  try {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return context.json({ error: "Payload too large" }, 413);
    }
    const parsed = (action === "register" ? registerSchema : revokeSchema).safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : invalid(context);
  } catch { return invalid(context); }
}

function requireConfig(context: Context, deps: Deps): OfflineCodeV2OwnerRoutesConfig | Response {
  if (!(deps.approved ?? (CLAIMANT_OFFLINE_CODE_V2_OWNER_ROUTES_APPROVED || isClaimantPreviewActivated()))) {
    return notFound(context);
  }
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "offlineCodeV2"); }
  catch (error) {
    if (error instanceof ClaimantCapabilityDisabledError) return notFound(context);
    throw error;
  }
  return (deps.getConfig ?? getOfflineCodeV2OwnerRoutesConfig)() ?? generic(context, 503);
}

function routeError(context: Context, error: unknown): Response {
  if (error instanceof AuthenticationError) return context.json({ error: "Unauthorized" }, 401);
  if (error instanceof ClaimantAssuranceError) {
    return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  }
  if (error instanceof RegisteredRecipientMutationError && error.code === "28000") {
    return context.json({ error: "Unauthorized" }, 401);
  }
  if (error instanceof OfflineCodeV2PersistenceTransactionError) {
    if (["22023", "23505", "40001"].includes(error.code ?? "")) return generic(context, 409);
    if (error.code === "42501") return notFound(context);
  }
  return generic(context, 503);
}

class AuthenticationError extends Error {}

function requireActiveOwnerAssurance(session: ClaimantApiSession, nowEpochSeconds: number): void {
  if (session.aal !== "aal2" || session.expiresAt <= nowEpochSeconds
    || session.amr.some(({ method }) => method === "recovery" || method === "password_recovery")) {
    throw new ClaimantAssuranceError();
  }
}

function createPersistence(config: OfflineCodeV2OwnerRoutesConfig) {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false,
  } });
  return createOfflineCodeV2PersistenceTransactionClient((name, input) => client.rpc(name, input));
}

function createSheetReader(config: OfflineCodeV2OwnerRoutesConfig) {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false,
  } });
  return createOfflineCodeV2OwnerSheetReader((name, input) => client.rpc(name, input));
}

function now(deps: Deps): Date { return deps.now?.() ?? new Date(); }
function sha256(value: Uint8Array): string { return createHash("sha256").update(value).digest("base64url"); }

function originsMatch(context: Context, config: OfflineCodeV2OwnerRoutesConfig): boolean {
  try { return context.req.header("Origin") === config.ownerOrigin
    && new URL(context.req.url).origin === config.apiOrigin; } catch { return false; }
}

function setHeaders(context: Context, origin: string): void {
  context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store");
  context.header("Referrer-Policy", "no-referrer");
  context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff");
}

function notFound(context: Context) { return context.json({ error: "Not found" }, 404); }
function invalid(context: Context) { return context.json({ error: "Invalid request" }, 400); }
function generic(context: Context, status: 409 | 503) {
  return context.json({ error: "Request could not be completed" }, status);
}

function getOfflineCodeV2OwnerRoutesConfig(): OfflineCodeV2OwnerRoutesConfig | null {
  const apiOrigin = exactHttpsOrigin(process.env.OFFLINE_CODE_V2_API_ORIGIN);
  const ownerOrigin = exactHttpsOrigin(process.env.OFFLINE_CODE_V2_OWNER_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(process.env.OFFLINE_CODE_V2_CLAIMANT_ORIGIN);
  const locatorIndexKey = exactKey(process.env.OFFLINE_CODE_V2_LOCATOR_INDEX_KEY);
  const freshAssuranceSeconds = Number(process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = exactHttpsOrigin(process.env.SUPABASE_URL);
  if (!apiOrigin || !ownerOrigin || !claimantOrigin || ownerOrigin === claimantOrigin
    || ownerOrigin === apiOrigin || !locatorIndexKey || !serviceRoleKey || !supabaseUrl
    || !Number.isInteger(freshAssuranceSeconds) || freshAssuranceSeconds < 60
    || freshAssuranceSeconds > 600) return null;
  return { apiOrigin, ownerOrigin, freshAssuranceSeconds, locatorIndexKey, serviceRoleKey, supabaseUrl };
}

function exactHttpsOrigin(value: string | undefined): string | null {
  try { if (!value || value !== value.trim()) return null; const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}

function exactKey(value: string | undefined): string | null {
  if (!value || !base64url32.safeParse(value).success) return null;
  return Buffer.from(value, "base64url").toString("base64url") === value ? value : null;
}
