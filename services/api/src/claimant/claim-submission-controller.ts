import type { Context } from "hono";
import { z } from "zod";

import { readBearerToken } from "../security/http.js";
import { createClaimantPortalSessionClient, ClaimantPortalSessionError,
  type ClaimantPortalSessionClient } from "./portal-session-client.js";
import type { RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";
import { createClaimSubmissionServiceV1, ClaimSubmissionServiceError } from
  "./claim-submission-service.js";
import { createClaimSubmissionSupabaseTransactionClientV1, ClaimSubmissionTransactionError,
  type ClaimSubmissionTransactionClientV1 } from "./claim-submission-transaction-client.js";
import { ClaimantCapabilityDisabledError, getClaimantRuntimeConfig, requireClaimantCapability,
  type ClaimantRuntimeConfig } from "./runtime-config.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";

export const CLAIMANT_SUBMISSION_CONTROLLER_APPROVED = false as const;
const MAX_BODY_BYTES = 16_384;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const requestSchema = z.strictObject({ envelope: z.unknown(),
  expected_intake_version: z.number().int().min(2),
  expected_preparation_version: z.number().int().min(2) });

export type ClaimSubmissionControllerConfigV1 = RegisteredRecipientSupabaseConfig & Readonly<{
  apiOrigin: string; claimantOrigin: string; freshAssuranceSeconds: number;
}>;
export type ClaimSubmissionConcurrencyGuardV1 = Readonly<{
  acquire(key: string): (() => void) | null;
}>;
type Deps = Readonly<{ approved?: boolean; concurrency?: ClaimSubmissionConcurrencyGuardV1;
  createPortalClient?: (config: RegisteredRecipientSupabaseConfig) => ClaimantPortalSessionClient;
  createTransactions?: (config: RegisteredRecipientSupabaseConfig) => ClaimSubmissionTransactionClientV1;
  getConfig?: () => ClaimSubmissionControllerConfigV1 | null; now?: () => Date;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

export function createClaimSubmissionConcurrencyGuardV1(maxPerClaimantCase = 1): ClaimSubmissionConcurrencyGuardV1 {
  if (!Number.isSafeInteger(maxPerClaimantCase) || maxPerClaimantCase < 1 || maxPerClaimantCase > 2) {
    throw new Error("Invalid claimant submission concurrency bound.");
  }
  const active = new Map<string, number>();
  return { acquire(key) { const count = active.get(key) ?? 0;
    if (count >= maxPerClaimantCase) return null; active.set(key, count + 1); let released = false;
    return () => { if (released) return; released = true; const remaining = (active.get(key) ?? 1) - 1;
      if (remaining > 0) active.set(key, remaining); else active.delete(key); }; } };
}
const defaultConcurrency = createClaimSubmissionConcurrencyGuardV1();

export function createClaimSubmissionControllerV1(deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, deps); if (prepared instanceof Response) return prepared;
    let release: (() => void) | null = null;
    try {
      let session;
      try { session = await prepared.portal.getSession(prepared.jwt); }
      catch { return context.json({ error: "Unauthorized" }, 401); }
      requireFreshClaimantAssurance(session,
        Math.floor((deps.now?.() ?? new Date()).getTime() / 1000), prepared.config.freshAssuranceSeconds);
      await prepared.portal.assert(session.userId, session.sessionId);
      release = (deps.concurrency ?? defaultConcurrency).acquire(`${session.userId}|${prepared.caseId}`);
      if (!release) { context.header("Retry-After", "1"); return generic(context, 429); }
      const body = await readJson(context); if (body instanceof Response) return body;
      const transactions = (deps.createTransactions ?? createClaimSubmissionSupabaseTransactionClientV1)(
        prepared.config);
      const result = await createClaimSubmissionServiceV1({ approved: true,
        serverTime: () => (deps.now?.() ?? new Date()).toISOString(), transactions }).submit({
        caseId: prepared.caseId, claimantUserId: session.userId, envelope: body.envelope,
        expectedIntakeVersion: body.expected_intake_version,
        expectedPreparationVersion: body.expected_preparation_version,
        idempotencyKey: prepared.idempotencyKey, portalSessionId: session.sessionId });
      return context.json({ result: { acknowledgement_ref: result.acknowledgementRef,
        case_id: result.caseId, case_version: result.caseVersion, intake_version: result.intakeVersion,
        preparation_version: result.preparationVersion, release_authorized: result.releaseAuthorized,
        replayed: result.replayed, review_started: result.reviewStarted, state: result.state,
        status: result.status } }, 200);
    } catch (error) { return controllerError(context, error); }
    finally { release?.(); }
  };
}

export function createClaimSubmissionPreflightControllerV1(deps: Deps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!originsMatch(context, config)) return context.json({ error: "Not found" }, 404);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = new Set(context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean));
    const allowed = new Set(["authorization", "content-type", "idempotency-key"]);
    if (method !== "POST" || headers.size !== allowed.size
      || [...headers].some((value) => !allowed.has(value))) return context.json({ error: "Not found" }, 404);
    setHeaders(context, config.claimantOrigin);
    context.header("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST");
    context.header("Access-Control-Max-Age", "600"); return context.body(null, 204);
  };
}

type Prepared = Readonly<{ caseId: string; config: ClaimSubmissionControllerConfigV1;
  idempotencyKey: string; jwt: string; portal: ClaimantPortalSessionClient }>;
function prepare(context: Context, deps: Deps): Prepared | Response {
  const config = requireConfig(context, deps); if (config instanceof Response) return config;
  if (!originsMatch(context, config)) return context.json({ error: "Not found" }, 404);
  setHeaders(context, config.claimantOrigin);
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
  return { caseId: caseId.data, config, idempotencyKey: idempotencyKey.data, jwt,
    portal: (deps.createPortalClient ?? createClaimantPortalSessionClient)(config) };
}
async function readJson(context: Context): Promise<z.infer<typeof requestSchema> | Response> {
  try { const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return context.json({ error: "Payload too large" }, 413);
    }
    const parsed = requestSchema.safeParse(JSON.parse(text)); return parsed.success ? parsed.data : invalid(context);
  } catch { return invalid(context); }
}
function requireConfig(context: Context, deps: Deps): ClaimSubmissionControllerConfigV1 | Response {
  if (!(deps.approved ?? CLAIMANT_SUBMISSION_CONTROLLER_APPROVED)) return context.json({ error: "Not found" }, 404);
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "claimIntake"); }
  catch (error) { if (error instanceof ClaimantCapabilityDisabledError) {
    return context.json({ error: "Not found" }, 404); } throw error; }
  return (deps.getConfig ?? getClaimSubmissionControllerConfigV1)() ?? generic(context, 503);
}
function originsMatch(context: Context, config: ClaimSubmissionControllerConfigV1) {
  try { return context.req.header("Origin") === config.claimantOrigin
    && new URL(context.req.url).origin === config.apiOrigin; } catch { return false; }
}
function controllerError(context: Context, error: unknown) {
  if (error instanceof ClaimantAssuranceError) {
    return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  }
  if (error instanceof ClaimantPortalSessionError && error.code === "28000") {
    return context.json({ error: "Unauthorized" }, 401);
  }
  if (error instanceof ClaimantPortalSessionError && error.code === "42501") {
    return context.json({ error: "Not found" }, 404);
  }
  if (error instanceof ClaimSubmissionServiceError && error.kind === "invalid_submission") return invalid(context);
  if (error instanceof ClaimSubmissionTransactionError && ["22023", "23505", "40001"].includes(error.code ?? "")) {
    return generic(context, 409);
  }
  if (error instanceof ClaimSubmissionTransactionError && error.code === "42501") {
    return context.json({ error: "Not found" }, 404);
  }
  return generic(context, 500);
}
function setHeaders(context: Context, origin: string) { context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store"); context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff"); }
function invalid(context: Context) { return context.json({ error: "Invalid request" }, 400); }
function generic(context: Context, status: 409 | 429 | 500 | 503) {
  return context.json({ error: "Request could not be completed" }, status);
}
function getClaimSubmissionControllerConfigV1(): ClaimSubmissionControllerConfigV1 | null {
  const apiOrigin = exactHttpsOrigin(process.env.CLAIMANT_SUBMISSION_API_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(process.env.CLAIMANT_SUBMISSION_PORTAL_ORIGIN);
  const freshAssuranceSeconds = Number(process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = exactHttpsOrigin(process.env.SUPABASE_URL);
  if (!apiOrigin || !claimantOrigin || !serviceRoleKey || !supabaseUrl
    || !Number.isInteger(freshAssuranceSeconds) || freshAssuranceSeconds < 60
    || freshAssuranceSeconds > 600) return null;
  return { apiOrigin, claimantOrigin, freshAssuranceSeconds, serviceRoleKey, supabaseUrl };
}
function exactHttpsOrigin(value: string | undefined): string | null {
  try { if (!value || value !== value.trim()) return null; const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}
