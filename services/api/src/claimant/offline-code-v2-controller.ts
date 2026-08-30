import { createHmac } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import { z } from "zod";

import { createOfflineCodeV2ChallengeCoordinator,
  OfflineCodeV2ChallengeCoordinatorError,
  type OfflineCodeV2BoundaryIndexer }
  from "./offline-code-v2-challenge-coordinator.js";
import { createOfflineCodeV2PersistenceTransactionClient,
  type OfflineCodeV2PersistenceTransactionClient }
  from "./offline-code-v2-persistence-transaction-client.js";
import { createOfflineCodeV2ProofAttemptCoordinator,
  OfflineCodeV2ProofAttemptCoordinatorError }
  from "./offline-code-v2-proof-attempt-coordinator.js";
import { ClaimantCapabilityDisabledError, getClaimantRuntimeConfig,
  requireClaimantCapability, type ClaimantRuntimeConfig } from "./runtime-config.js";

export const CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED = false as const;

export type OfflineCodeV2ControllerAction = "issueChallenge" | "verifyProof";
export type OfflineCodeV2ControllerConfig = Readonly<{
  apiOrigin: string;
  claimantOrigin: string;
  locatorIndexKey: string;
  rateLimitKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}>;
export type OfflineCodeV2TrustedSignals = Readonly<{
  networkSignal: string;
  deviceSignal?: string;
}>;

type Deps = Readonly<{
  approved?: boolean;
  createIndexer?: (config: OfflineCodeV2ControllerConfig) => OfflineCodeV2BoundaryIndexer;
  createPersistence?: (config: OfflineCodeV2ControllerConfig) =>
    OfflineCodeV2PersistenceTransactionClient;
  getConfig?: () => OfflineCodeV2ControllerConfig | null;
  getTrustedSignals?: (context: Context) => PromiseLike<OfflineCodeV2TrustedSignals | null>;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

const MAX_BODY_BYTES = 16_384;
const uuidV4 = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
);
const issueSchema = z.strictObject({ locator: z.unknown() });
const proofSchema = z.strictObject({ challenge: z.unknown(),
  challenge_bytes_base64url: z.string().min(1).max(8_192), possession_proof: z.unknown() });
const base64url32 = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;

export function createOfflineCodeV2Controller(action: OfflineCodeV2ControllerAction,
  deps: Deps = {}) {
  return async (context: Context): Promise<Response> => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!originsMatch(context, config)) return notFound(context);
    setResponseHeaders(context, config.claimantOrigin);
    if (context.req.header("Authorization") || context.req.header("Cookie")) return notFound(context);
    if (context.req.header("Content-Type")?.trim().toLowerCase() !== "application/json") {
      return context.json({ error: "Unsupported media type" }, 415);
    }
    const idempotencyKey = uuidV4.safeParse(context.req.header("Idempotency-Key")?.trim());
    if (!idempotencyKey.success) return invalid(context);
    const declared = context.req.header("Content-Length")?.trim();
    if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
      return context.json({ error: "Payload too large" }, 413);
    }
    const body = await readBody(context, action); if (body instanceof Response) return body;

    try {
      if (action === "issueChallenge") {
        const issueBody = body as z.infer<typeof issueSchema>;
        const signals = await deps.getTrustedSignals?.(context) ?? null;
        if (!signals) return generic(context, 503);
        const persistence = (deps.createPersistence ?? createPersistence)(config);
        const coordinator = createOfflineCodeV2ChallengeCoordinator({ approved: true,
          origin: config.claimantOrigin,
          indexer: (deps.createIndexer ?? createOfflineCodeV2BoundaryIndexer)(config), persistence });
        const result = await coordinator.issue({ locator: issueBody.locator,
          networkSignal: signals.networkSignal, deviceSignal: signals.deviceSignal,
          idempotencyKey: idempotencyKey.data });
        if (result.status === "rate_limited") {
          context.header("Retry-After", String(result.retryAfterSeconds));
          return context.json({ result: { status: result.status,
            retry_after_seconds: result.retryAfterSeconds,
            identity_verified: result.identityVerified, claim_created: result.claimCreated,
            release_authorized: result.releaseAuthorized } }, 429);
        }
        return context.json({ result: { status: result.status, authority: result.authority,
          challenge: result.challenge,
          challenge_bytes_base64url: result.challengeBytesBase64url,
          kdf_profile: result.kdfProfile, identity_verified: result.identityVerified,
          claim_created: result.claimCreated,
          release_authorized: result.releaseAuthorized } }, 200);
      }

      const proofBody = body as z.infer<typeof proofSchema>;
      const challengeId = uuidV4.safeParse(context.req.param("challengeId"));
      if (!challengeId.success || !hasChallengeId(proofBody.challenge, challengeId.data)) {
        return invalid(context);
      }
      const persistence = (deps.createPersistence ?? createPersistence)(config);
      const coordinator = createOfflineCodeV2ProofAttemptCoordinator({ approved: true,
        persistence });
      const result = await coordinator.verify({ challenge: proofBody.challenge,
        challengeBytesBase64url: proofBody.challenge_bytes_base64url,
        possessionProof: proofBody.possession_proof, idempotencyKey: idempotencyKey.data });
      if (result.status === "proof_rejected") {
        return context.json({ result: { status: result.status,
          route_possession_asserted: result.routePossessionAsserted,
          identity_verified: result.identityVerified, claim_created: result.claimCreated,
          release_authorized: result.releaseAuthorized } }, 401);
      }
      return context.json({ result: { status: result.status, authority: result.authority,
        route_possession_asserted: result.routePossessionAsserted,
        identity_verified: result.identityVerified, claim_created: result.claimCreated,
        release_authorized: result.releaseAuthorized } }, 200);
    } catch (error) {
      if ((error instanceof OfflineCodeV2ChallengeCoordinatorError
          || error instanceof OfflineCodeV2ProofAttemptCoordinatorError)
        && error.kind === "invalid_input") return invalid(context);
      return generic(context, 503);
    }
  };
}

export function createOfflineCodeV2PreflightController(deps: Deps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!originsMatch(context, config)) return notFound(context);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = new Set(context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean));
    const allowed = new Set(["content-type", "idempotency-key"]);
    if (method !== "POST" || headers.size !== allowed.size
      || [...headers].some((value) => !allowed.has(value))) return notFound(context);
    setResponseHeaders(context, config.claimantOrigin);
    context.header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
    context.header("Access-Control-Allow-Methods", "POST");
    context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

function requireConfig(context: Context, deps: Deps): OfflineCodeV2ControllerConfig | Response {
  if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_CONTROLLER_APPROVED)) return notFound(context);
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "offlineCodeV2"); }
  catch (error) { if (error instanceof ClaimantCapabilityDisabledError) return notFound(context);
    throw error; }
  return (deps.getConfig ?? getControllerConfig)() ?? generic(context, 503);
}

async function readBody(context: Context, action: OfflineCodeV2ControllerAction):
Promise<z.infer<typeof issueSchema> | z.infer<typeof proofSchema> | Response> {
  try {
    const text = await context.req.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return context.json({ error: "Payload too large" }, 413);
    }
    const parsed = (action === "issueChallenge" ? issueSchema : proofSchema).safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : invalid(context);
  } catch { return invalid(context); }
}

function hasChallengeId(value: unknown, expected: string): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && (value as Record<string, unknown>).challenge_id === expected);
}

function createPersistence(config: OfflineCodeV2ControllerConfig) {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: {
    autoRefreshToken: false, detectSessionInUrl: false, persistSession: false,
  } });
  return createOfflineCodeV2PersistenceTransactionClient((name, input) => client.rpc(name, input));
}

export function createOfflineCodeV2BoundaryIndexer(config: OfflineCodeV2ControllerConfig):
OfflineCodeV2BoundaryIndexer {
  const locatorKey = Buffer.from(config.locatorIndexKey, "base64url");
  const rateKey = Buffer.from(config.rateLimitKey, "base64url");
  return { async derive(input) { return {
    locatorIndexDigest: keyedDigest(locatorKey, "locator", input.normalizedLocator),
    networkBucketDigest: keyedDigest(rateKey, "network", input.networkSignal),
    ...(input.deviceSignal
      ? { deviceBucketDigest: keyedDigest(rateKey, "device", input.deviceSignal) } : {}),
    globalBucketDigest: keyedDigest(rateKey, "global", "offline-code-v2"),
  }; } };
}

function keyedDigest(key: Buffer, scope: string, value: string): string {
  return createHmac("sha256", key).update("sanduqkin:claim:offline-code:v2:boundary")
    .update("\0").update(scope).update("\0").update(value).digest("base64url");
}

function originsMatch(context: Context, config: OfflineCodeV2ControllerConfig): boolean {
  try { return context.req.header("Origin") === config.claimantOrigin
    && new URL(context.req.url).origin === config.apiOrigin; } catch { return false; }
}

function setResponseHeaders(context: Context, origin: string): void {
  context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store");
  context.header("Cross-Origin-Resource-Policy", "same-site");
  context.header("Referrer-Policy", "no-referrer");
  context.header("Vary", "Origin");
  context.header("X-Content-Type-Options", "nosniff");
}

function getControllerConfig(): OfflineCodeV2ControllerConfig | null {
  const apiOrigin = exactHttpsOrigin(process.env.OFFLINE_CODE_V2_API_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(process.env.OFFLINE_CODE_V2_CLAIMANT_ORIGIN);
  const locatorIndexKey = exactKey(process.env.OFFLINE_CODE_V2_LOCATOR_INDEX_KEY);
  const rateLimitKey = exactKey(process.env.OFFLINE_CODE_V2_RATE_LIMIT_KEY);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = exactHttpsOrigin(process.env.SUPABASE_URL);
  if (!apiOrigin || !claimantOrigin || apiOrigin === claimantOrigin || !locatorIndexKey
    || !rateLimitKey || locatorIndexKey === rateLimitKey || !serviceRoleKey || !supabaseUrl) return null;
  return { apiOrigin, claimantOrigin, locatorIndexKey, rateLimitKey, serviceRoleKey, supabaseUrl };
}

function exactHttpsOrigin(value: string | undefined): string | null {
  try { if (!value || value !== value.trim()) return null; const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null;
  } catch { return null; }
}

function exactKey(value: string | undefined): string | null {
  if (!value || !base64url32.test(value)) return null;
  return Buffer.from(value, "base64url").toString("base64url") === value ? value : null;
}

function notFound(context: Context) { return context.json({ error: "Not found" }, 404); }
function invalid(context: Context) { return context.json({ error: "Invalid request" }, 400); }
function generic(context: Context, status: 503) {
  return context.json({ error: "Request could not be completed" }, status);
}
