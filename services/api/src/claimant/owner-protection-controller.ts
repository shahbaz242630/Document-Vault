import type { Context } from "hono";
import { z } from "zod";

import { readBearerToken } from "../security/http.js";
import { createOwnerProtectionServiceV1, OwnerProtectionServiceError }
  from "./owner-protection-service.js";
import { createOwnerProtectionSupabaseTransactionClientV1, OwnerProtectionTransactionError,
  type OwnerProtectionTransactionClientV1 } from "./owner-protection-transaction-client.js";
import { createClaimantPortalSessionClient, ClaimantPortalSessionError,
  type ClaimantPortalSessionClient } from "./portal-session-client.js";
import { createRegisteredRecipientSupabaseClient, RegisteredRecipientMutationError,
  type RegisteredRecipientClient, type RegisteredRecipientSupabaseConfig }
  from "./registered-recipient-client.js";
import { ClaimantCapabilityDisabledError, getClaimantRuntimeConfig, requireClaimantCapability,
  type ClaimantRuntimeConfig } from "./runtime-config.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";

export const CLAIMANT_OWNER_PROTECTION_CONTROLLER_APPROVED = false as const;
const MAX_BODY_BYTES = 4_096;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const bodySchema = z.strictObject({ cycle_id: uuid, expected_case_version: z.number().int().positive() });

export type OwnerProtectionControllerActionV1 = "claimantDispute" | "ownerCancel";
export type OwnerProtectionControllerConfigV1 = RegisteredRecipientSupabaseConfig & Readonly<{
  apiOrigin: string; claimantOrigin: string; freshAssuranceSeconds: number; ownerOrigin: string;
}>;
export type OwnerProtectionConcurrencyGuardV1 = Readonly<{
  acquire(key: string): (() => void) | null;
}>;
type Deps = Readonly<{ approved?: boolean; concurrency?: OwnerProtectionConcurrencyGuardV1;
  createOwnerSessionClient?: (config: RegisteredRecipientSupabaseConfig) => RegisteredRecipientClient;
  createPortalClient?: (config: RegisteredRecipientSupabaseConfig) => ClaimantPortalSessionClient;
  createTransactions?: (config: RegisteredRecipientSupabaseConfig) => OwnerProtectionTransactionClientV1;
  getConfig?: () => OwnerProtectionControllerConfigV1 | null; now?: () => Date;
  runtimeConfig?: ClaimantRuntimeConfig }>;

export function createOwnerProtectionConcurrencyGuardV1(maxPerActorCase = 1):
OwnerProtectionConcurrencyGuardV1 {
  if (!Number.isSafeInteger(maxPerActorCase) || maxPerActorCase < 1 || maxPerActorCase > 2) {
    throw new Error("Invalid owner-protection concurrency bound.");
  }
  const active = new Map<string, number>();
  return { acquire(key) { const count = active.get(key) ?? 0;
    if (count >= maxPerActorCase) return null; active.set(key, count + 1); let released = false;
    return () => { if (released) return; released = true; const remaining = (active.get(key) ?? 1) - 1;
      if (remaining > 0) active.set(key, remaining); else active.delete(key); }; } };
}
const defaultConcurrency = createOwnerProtectionConcurrencyGuardV1();

export function createOwnerProtectionControllerV1(action: OwnerProtectionControllerActionV1,
  deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, action, deps); if (prepared instanceof Response) return prepared;
    let release: (() => void) | null = null;
    try {
      const session = await authenticate(prepared);
      requireFreshClaimantAssurance(session,
        Math.floor((deps.now?.() ?? new Date()).getTime() / 1000), prepared.config.freshAssuranceSeconds);
      if (prepared.action === "ownerCancel") {
        await prepared.ownerSession.assertActiveSession(session.userId, session.sessionId);
      } else {
        await prepared.portal.assert(session.userId, session.sessionId);
      }
      release = (deps.concurrency ?? defaultConcurrency).acquire(`${action}|${session.userId}|${prepared.caseId}`);
      if (!release) { context.header("Retry-After", "1"); return generic(context, 429); }
      const body = await readJson(context); if (body instanceof Response) return body;
      const transactions = (deps.createTransactions ?? createOwnerProtectionSupabaseTransactionClientV1)(
        prepared.config);
      const result = await createOwnerProtectionServiceV1({ approved: true, transactions }).stop({
        actorUserId: session.userId, caseId: prepared.caseId, cycleId: body.cycle_id,
        expectedCaseVersion: body.expected_case_version, idempotencyKey: prepared.idempotencyKey,
        reason: prepared.action === "ownerCancel" ? "owner_cancelled" : "claimant_dispute" });
      return context.json({ result: { case_id: result.caseId, case_version: result.caseVersion,
        cooldown_active: result.cooldownActive, cooldown_expires_at: result.cooldownExpiresAt,
        cycle_id: result.cycleId, cycle_number: result.cycleNumber,
        release_authorized: result.releaseAuthorized, replayed: result.replayed,
        review_started: result.reviewStarted, state: result.state, status: result.status } }, 200);
    } catch (error) { return controllerError(context, error); }
    finally { release?.(); }
  };
}

export function createOwnerProtectionPreflightControllerV1(action: OwnerProtectionControllerActionV1,
  deps: Deps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    const expectedOrigin = originFor(action, config);
    if (!originsMatch(context, config.apiOrigin, expectedOrigin)) {
      return context.json({ error: "Not found" }, 404);
    }
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = new Set(context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean));
    const allowed = new Set(["authorization", "content-type", "idempotency-key"]);
    if (method !== "POST" || headers.size !== allowed.size
      || [...headers].some((value) => !allowed.has(value))) {
      return context.json({ error: "Not found" }, 404);
    }
    setHeaders(context, expectedOrigin);
    context.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST");
    context.header("Access-Control-Max-Age", "600"); return context.body(null, 204);
  };
}

type Prepared = Readonly<{ caseId: string; config: OwnerProtectionControllerConfigV1;
  idempotencyKey: string; jwt: string }> & (
    Readonly<{ action: "ownerCancel"; ownerSession: RegisteredRecipientClient }> |
    Readonly<{ action: "claimantDispute"; portal: ClaimantPortalSessionClient }>
  );
function prepare(context: Context, action: OwnerProtectionControllerActionV1,
  deps: Deps): Prepared | Response {
  const config = requireConfig(context, deps); if (config instanceof Response) return config;
  const expectedOrigin = originFor(action, config);
  if (!originsMatch(context, config.apiOrigin, expectedOrigin)) {
    return context.json({ error: "Not found" }, 404);
  }
  setHeaders(context, expectedOrigin);
  if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") {
    return context.json({ error: "Unsupported media type" }, 415);
  }
  const caseId = uuid.safeParse(context.req.param("caseId"));
  const idempotencyKey = uuid.safeParse(context.req.header("Idempotency-Key")?.trim());
  const jwt = readBearerToken(context.req.header("Authorization"));
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  if (!caseId.success || !idempotencyKey.success) return invalid(context);
  const declared = context.req.header("Content-Length")?.trim();
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    return context.json({ error: "Payload too large" }, 413);
  }
  const common = { caseId: caseId.data, config, idempotencyKey: idempotencyKey.data, jwt };
  return action === "ownerCancel"
    ? { ...common, action, ownerSession:
      (deps.createOwnerSessionClient ?? createRegisteredRecipientSupabaseClient)(config) }
    : { ...common, action, portal:
      (deps.createPortalClient ?? createClaimantPortalSessionClient)(config) };
}
async function authenticate(prepared: Prepared) {
  try { return prepared.action === "ownerCancel"
    ? await prepared.ownerSession.getSession(prepared.jwt)
    : await prepared.portal.getSession(prepared.jwt); }
  catch { throw new AuthenticationError(); }
}
async function readJson(context: Context): Promise<z.infer<typeof bodySchema> | Response> {
  try { const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return context.json({ error: "Payload too large" }, 413);
    }
    const parsed = bodySchema.safeParse(JSON.parse(text)); return parsed.success ? parsed.data : invalid(context);
  } catch { return invalid(context); }
}
function requireConfig(context: Context, deps: Deps): OwnerProtectionControllerConfigV1 | Response {
  if (!(deps.approved ?? CLAIMANT_OWNER_PROTECTION_CONTROLLER_APPROVED)) {
    return context.json({ error: "Not found" }, 404);
  }
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "ownerProtection"); }
  catch (error) { if (error instanceof ClaimantCapabilityDisabledError) {
    return context.json({ error: "Not found" }, 404); } throw error; }
  return (deps.getConfig ?? getOwnerProtectionControllerConfigV1)() ?? generic(context, 503);
}
function controllerError(context: Context, error: unknown) {
  if (error instanceof AuthenticationError) return context.json({ error: "Unauthorized" }, 401);
  if (error instanceof ClaimantAssuranceError) {
    return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  }
  if ((error instanceof RegisteredRecipientMutationError || error instanceof ClaimantPortalSessionError)
    && error.code === "28000") return context.json({ error: "Unauthorized" }, 401);
  if ((error instanceof RegisteredRecipientMutationError || error instanceof ClaimantPortalSessionError)
    && error.code === "42501") return context.json({ error: "Not found" }, 404);
  if (error instanceof OwnerProtectionServiceError && error.kind === "invalid_input") return invalid(context);
  if (error instanceof OwnerProtectionTransactionError
    && ["22023", "23505", "40001"].includes(error.code ?? "")) return generic(context, 409);
  if (error instanceof OwnerProtectionTransactionError && error.code === "42501") {
    return context.json({ error: "Not found" }, 404);
  }
  return generic(context, 500);
}
class AuthenticationError extends Error {}
function originFor(action: OwnerProtectionControllerActionV1, config: OwnerProtectionControllerConfigV1) {
  return action === "ownerCancel" ? config.ownerOrigin : config.claimantOrigin;
}
function originsMatch(context: Context, apiOrigin: string, clientOrigin: string) {
  try { return context.req.header("Origin") === clientOrigin
    && new URL(context.req.url).origin === apiOrigin; } catch { return false; }
}
function setHeaders(context: Context, origin: string) { context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store"); context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff"); }
function invalid(context: Context) { return context.json({ error: "Invalid request" }, 400); }
function generic(context: Context, status: 409 | 429 | 500 | 503) {
  return context.json({ error: "Request could not be completed" }, status);
}
function getOwnerProtectionControllerConfigV1(): OwnerProtectionControllerConfigV1 | null {
  const apiOrigin = exactHttpsOrigin(process.env.OWNER_PROTECTION_API_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(process.env.OWNER_PROTECTION_CLAIMANT_ORIGIN);
  const ownerOrigin = exactHttpsOrigin(process.env.OWNER_PROTECTION_OWNER_ORIGIN);
  const freshAssuranceSeconds = Number(process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = exactHttpsOrigin(process.env.SUPABASE_URL);
  if (!apiOrigin || !claimantOrigin || !ownerOrigin || claimantOrigin === ownerOrigin
    || !serviceRoleKey || !supabaseUrl || !Number.isInteger(freshAssuranceSeconds)
    || freshAssuranceSeconds < 60 || freshAssuranceSeconds > 600) return null;
  return { apiOrigin, claimantOrigin, freshAssuranceSeconds, ownerOrigin, serviceRoleKey, supabaseUrl };
}
function exactHttpsOrigin(value: string | undefined): string | null {
  try { if (!value || value !== value.trim()) return null; const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}
