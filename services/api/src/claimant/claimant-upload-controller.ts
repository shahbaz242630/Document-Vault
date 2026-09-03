import { createHmac } from "node:crypto";
import type { Context } from "hono";
import { z } from "zod";

import { claimantChecklistItemKeys, syntheticEvidenceMediaTypes,
  type SyntheticEvidenceMediaType } from "@vault/shared-types";

import { readBearerToken } from "../security/http.js";
import { createClaimantUploadProcessorV1, ClaimantUploadProcessorError,
  CLAIMANT_UPLOAD_MAX_BYTES, type QuarantineStorageProcessorAdapterV1,
  type StoredEvidenceInspectorAdapterV1 } from "./claimant-upload-processor.js";
import { createClaimantPortalSessionClient, ClaimantPortalSessionError,
  type ClaimantPortalSessionClient } from "./portal-session-client.js";
import { createPrivateQuarantineCapabilityServiceV1, type MalwareScannerAdapterV1,
  PrivateQuarantineServiceError } from "./private-quarantine-service.js";
import { createPrivateQuarantineSupabaseTransactionClientV1, PrivateQuarantineTransactionError,
  type PrivateQuarantineTransactionClientV1 } from "./private-quarantine-transaction-client.js";
import type { RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";
import { ClaimantCapabilityDisabledError, getClaimantRuntimeConfig, requireClaimantCapability,
  type ClaimantRuntimeConfig } from "./runtime-config.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance } from "./session-assurance.js";

export const CLAIMANT_UPLOAD_CONTROLLER_APPROVED = false as const;
const MAX_JSON_BYTES = 4_096;
const RETENTION_MILLISECONDS = 30 * 24 * 60 * 60 * 1_000;
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const capability = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const positiveVersion = z.number().int().positive();
const capabilityBody = z.strictObject({ expected_case_version: positiveVersion,
  expected_intake_version: positiveVersion, item_key: z.enum(claimantChecklistItemKeys),
  placeholder_ref: z.string().regex(/^synthetic_evidence_[a-z0-9_]+$/u).max(160),
  preparation_version: positiveVersion });
const emptyBody = z.strictObject({});

export type ClaimantUploadControllerConfigV1 = RegisteredRecipientSupabaseConfig & Readonly<{
  apiOrigin: string; capabilityDerivationKey: Buffer; claimantOrigin: string;
  controllerDerivationKey: Buffer; freshAssuranceSeconds: number; processorUserId: string;
}>;

export type ClaimantUploadControllerActionV1 = "issue" | "upload" | "reconcile";
export type ClaimantUploadConcurrencyGuardV1 = Readonly<{
  acquire(key: string): (() => void) | null;
}>;
type ControllerDeps = Readonly<{ approved?: boolean;
  concurrency?: ClaimantUploadConcurrencyGuardV1;
  createPortalClient?: (config: RegisteredRecipientSupabaseConfig) => ClaimantPortalSessionClient;
  createTransactions?: (config: RegisteredRecipientSupabaseConfig) => PrivateQuarantineTransactionClientV1;
  getConfig?: () => ClaimantUploadControllerConfigV1 | null;
  inspector?: StoredEvidenceInspectorAdapterV1; now?: () => Date;
  runtimeConfig?: ClaimantRuntimeConfig; scanner?: MalwareScannerAdapterV1;
  storage?: QuarantineStorageProcessorAdapterV1;
}>;

export function createClaimantUploadConcurrencyGuardV1(maxPerClaimantCase = 1): ClaimantUploadConcurrencyGuardV1 {
  if (!Number.isSafeInteger(maxPerClaimantCase) || maxPerClaimantCase < 1 || maxPerClaimantCase > 4) {
    throw new Error("Invalid claimant upload concurrency bound.");
  }
  const active = new Map<string, number>();
  return { acquire(key) {
    const count = active.get(key) ?? 0;
    if (count >= maxPerClaimantCase) return null;
    active.set(key, count + 1);
    let released = false;
    return () => { if (released) return; released = true; const remaining = (active.get(key) ?? 1) - 1;
      if (remaining > 0) active.set(key, remaining); else active.delete(key); };
  } };
}

const defaultConcurrency = createClaimantUploadConcurrencyGuardV1();

export function createClaimantUploadControllerV1(action: ClaimantUploadControllerActionV1,
  deps: ControllerDeps = {}) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, action, deps);
    if (prepared instanceof Response) return prepared;
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
      const transactions = (deps.createTransactions ?? createPrivateQuarantineSupabaseTransactionClientV1)(prepared.config);
      if (action === "issue") {
        const response = await issueCapability(context, prepared, session, transactions, deps);
        return response;
      }
      if (!deps.storage || !deps.inspector || !deps.scanner) return generic(context, 503);
      const response = action === "upload"
        ? await upload(context, prepared, prepared.config.processorUserId, transactions, deps)
        : await reconcile(context, prepared, prepared.config.processorUserId, transactions, deps);
      return response;
    } catch (error) { return controllerError(context, error); }
    finally { release?.(); }
  };
}

export function createClaimantUploadPreflightControllerV1(action: ClaimantUploadControllerActionV1,
  deps: ControllerDeps = {}) {
  return (context: Context): Response => {
    const config = requireConfig(context, deps); if (config instanceof Response) return config;
    if (!requestOriginsMatch(context, config)) return context.json({ error: "Not found" }, 404);
    const method = context.req.header("Access-Control-Request-Method")?.trim().toUpperCase();
    const headers = new Set(context.req.header("Access-Control-Request-Headers")?.split(",")
      .map((value) => value.trim().toLowerCase()).filter(Boolean));
    const expectedMethod = action === "upload" ? "PUT" : "POST";
    const allowed = action === "upload"
      ? new Set(["authorization", "content-type", "idempotency-key", "x-claimant-upload-capability"])
      : action === "reconcile"
        ? new Set(["authorization", "content-type", "idempotency-key", "x-claimant-upload-capability"])
        : new Set(["authorization", "content-type", "idempotency-key"]);
    if (method !== expectedMethod || headers.size !== allowed.size
      || [...headers].some((value) => !allowed.has(value))) {
      return context.json({ error: "Not found" }, 404);
    }
    setHeaders(context, config.claimantOrigin);
    context.header("Access-Control-Allow-Headers", [...allowed].map(headerCase).join(", "));
    context.header("Access-Control-Allow-Methods", expectedMethod);
    context.header("Access-Control-Max-Age", "600");
    return context.body(null, 204);
  };
}

type Prepared = Readonly<{ caseId: string; config: ClaimantUploadControllerConfigV1;
  expectedSizeBytes: number | null; idempotencyKey: string; jwt: string;
  objectId: string | null; objectPath: string | null;
  portal: ClaimantPortalSessionClient }>;

function prepare(context: Context, action: ClaimantUploadControllerActionV1,
  deps: ControllerDeps): Prepared | Response {
  const config = requireConfig(context, deps); if (config instanceof Response) return config;
  if (!requestOriginsMatch(context, config)) return context.json({ error: "Not found" }, 404);
  setHeaders(context, config.claimantOrigin);
  const caseId = uuid.safeParse(context.req.param("caseId"));
  const objectId = action === "issue" ? null : uuid.safeParse(context.req.param("objectId"));
  const idempotencyKey = uuid.safeParse(context.req.header("Idempotency-Key")?.trim());
  const jwt = readBearerToken(context.req.header("Authorization"));
  if (!jwt) return context.json({ error: "Unauthorized" }, 401);
  if (!caseId.success || !idempotencyKey.success || (objectId !== null && !objectId.success)) return invalid(context);
  const contentType = context.req.header("Content-Type")?.trim().toLowerCase();
  if (action !== "upload" && contentType !== "application/json") return context.json({ error: "Unsupported media type" }, 415);
  if (action === "upload" && !syntheticEvidenceMediaTypes.includes(contentType as SyntheticEvidenceMediaType)) {
    return context.json({ error: "Unsupported media type" }, 415);
  }
  const expectedSizeBytes = action === "upload"
    ? strictContentLength(context.req.header("Content-Length")) : null;
  if (action === "upload" && expectedSizeBytes === null) return invalid(context);
  return { caseId: caseId.data, config, expectedSizeBytes, idempotencyKey: idempotencyKey.data, jwt,
    objectId: objectId?.data ?? null, objectPath: objectId ? `v1/${caseId.data}/${objectId.data}` : null,
    portal: (deps.createPortalClient ?? createClaimantPortalSessionClient)(config) };
}

async function issueCapability(context: Context, prepared: Prepared,
  session: Awaited<ReturnType<ClaimantPortalSessionClient["getSession"]>>,
  transactions: PrivateQuarantineTransactionClientV1, deps: ControllerDeps) {
  const body = await readJson(context, capabilityBody); if (body instanceof Response) return body;
  const service = createPrivateQuarantineCapabilityServiceV1({ approved: true,
    capabilityDerivationKey: prepared.config.capabilityDerivationKey, transactions });
  const result = await service.issue({ caseId: prepared.caseId, claimantUserId: session.userId,
    expectedCaseVersion: body.expected_case_version, expectedIntakeVersion: body.expected_intake_version,
    idempotencyKey: prepared.idempotencyKey, issuedAt: (deps.now?.() ?? new Date()).toISOString(),
    itemKey: body.item_key, placeholderRef: body.placeholder_ref, portalSessionId: session.sessionId,
    preparationVersion: body.preparation_version });
  return context.json({ result: { bucket: result.bucket, capability: result.capabilityToken,
    expires_at: result.expiresAt, object_id: result.objectId, object_path: result.objectPath } }, 200);
}

async function upload(context: Context, prepared: Prepared, processorUserId: string,
  transactions: PrivateQuarantineTransactionClientV1, deps: ControllerDeps) {
  const token = capability.safeParse(context.req.header("X-Claimant-Upload-Capability")?.trim());
  const body = context.req.raw.body;
  if (!token.success || prepared.expectedSizeBytes === null || !body
    || !prepared.objectId || !prepared.objectPath) return invalid(context);
  const keys = deriveOperationKeys(prepared.config.controllerDerivationKey, prepared.idempotencyKey);
  const processor = createClaimantUploadProcessorV1({ approved: true, inspector: deps.inspector!,
    scanner: deps.scanner!, storage: deps.storage!, transactions });
  const result = await processor.upload({ body: streamBody(body), capabilityToken: token.data,
    caseId: prepared.caseId, cleanupIdempotencyKey: keys.cleanup,
    deleteAfter: new Date((deps.now?.() ?? new Date()).getTime() + RETENTION_MILLISECONDS).toISOString(),
    expectedMediaType: context.req.header("Content-Type")!.trim().toLowerCase() as SyntheticEvidenceMediaType,
    expectedSizeBytes: prepared.expectedSizeBytes, objectId: prepared.objectId, objectPath: prepared.objectPath,
    processorUserId, quarantineIdempotencyKey: keys.quarantine, scanIdempotencyKey: keys.scan });
  return context.json({ result: { object_id: result.objectId, status: result.status,
    version: result.version } }, 200);
}

async function reconcile(context: Context, prepared: Prepared, processorUserId: string,
  transactions: PrivateQuarantineTransactionClientV1, deps: ControllerDeps) {
  const body = await readJson(context, emptyBody); if (body instanceof Response) return body;
  const token = capability.safeParse(context.req.header("X-Claimant-Upload-Capability")?.trim());
  if (!token.success || !prepared.objectId || !prepared.objectPath) return invalid(context);
  const keys = deriveOperationKeys(prepared.config.controllerDerivationKey, prepared.idempotencyKey);
  const processor = createClaimantUploadProcessorV1({ approved: true, inspector: deps.inspector!,
    scanner: deps.scanner!, storage: deps.storage!, transactions });
  const result = await processor.reconcile({ capabilityToken: token.data, caseId: prepared.caseId,
    cleanupIdempotencyKey: keys.cleanup,
    deleteAfter: new Date((deps.now?.() ?? new Date()).getTime() + RETENTION_MILLISECONDS).toISOString(),
    objectId: prepared.objectId, objectPath: prepared.objectPath, processorUserId,
    quarantineIdempotencyKey: keys.quarantine, scanIdempotencyKey: keys.scan });
  return context.json({ result }, 200);
}

function requireConfig(context: Context, deps: ControllerDeps): ClaimantUploadControllerConfigV1 | Response {
  if (!(deps.approved ?? CLAIMANT_UPLOAD_CONTROLLER_APPROVED)) return context.json({ error: "Not found" }, 404);
  try { requireClaimantCapability(deps.runtimeConfig ?? getClaimantRuntimeConfig(), "evidenceUpload"); }
  catch (error) { if (error instanceof ClaimantCapabilityDisabledError) return context.json({ error: "Not found" }, 404); throw error; }
  return (deps.getConfig ?? getClaimantUploadControllerConfigV1)() ?? generic(context, 503);
}

function requestOriginsMatch(context: Context, config: ClaimantUploadControllerConfigV1) {
  try { return context.req.header("Origin") === config.claimantOrigin
    && new URL(context.req.url).origin === config.apiOrigin; } catch { return false; }
}
function strictContentLength(value: string | undefined): number | null {
  if (!value || !/^[1-9][0-9]*$/u.test(value)) return null;
  const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed <= CLAIMANT_UPLOAD_MAX_BYTES ? parsed : null;
}
async function* streamBody(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  try { while (true) { const next = await reader.read(); if (next.done) return; yield next.value; } }
  finally { reader.releaseLock(); }
}
function deriveOperationKeys(key: Buffer, idempotencyKey: string) {
  if (key.length !== 32) throw new ClaimantUploadProcessorError("disabled");
  const derive = (purpose: string) => uuidFromDigest(createHmac("sha256", key)
    .update(`sanduqkin:claim:upload-controller:${purpose}:v1|${idempotencyKey}`).digest());
  return { cleanup: derive("cleanup"), quarantine: derive("quarantine"), scan: derive("scan") };
}
function uuidFromDigest(value: Buffer) { const bytes = Buffer.from(value.subarray(0, 16));
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128; const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
async function readJson<T extends z.ZodType>(context: Context, schema: T): Promise<z.infer<T> | Response> {
  const declared = context.req.header("Content-Length")?.trim();
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MAX_JSON_BYTES)) return context.json({ error: "Payload too large" }, 413);
  try { const text = await context.req.text(); if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) return context.json({ error: "Payload too large" }, 413);
    const parsed = schema.safeParse(JSON.parse(text)); return parsed.success ? parsed.data : invalid(context); }
  catch { return invalid(context); }
}
function controllerError(context: Context, error: unknown): Response {
  if (error instanceof ClaimantAssuranceError) return context.json({ error: "Fresh multi-factor authentication required" }, 403);
  if (error instanceof ClaimantPortalSessionError && error.code === "28000") return context.json({ error: "Unauthorized" }, 401);
  if (error instanceof ClaimantPortalSessionError && error.code === "42501") return context.json({ error: "Not found" }, 404);
  if (error instanceof ClaimantUploadProcessorError && error.kind === "invalid_request") return invalid(context);
  if (error instanceof ClaimantUploadProcessorError && error.kind === "reconciliation_required") return generic(context, 409);
  if (error instanceof PrivateQuarantineTransactionError && ["22023", "23505", "40001"].includes(error.code ?? "")) return generic(context, 409);
  if (error instanceof PrivateQuarantineTransactionError && error.code === "42501") return context.json({ error: "Not found" }, 404);
  if (error instanceof PrivateQuarantineServiceError && error.kind === "disabled") return generic(context, 503);
  return generic(context, 500);
}
function headerCase(value: string) { return value.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("-"); }
function setHeaders(context: Context, origin: string) { context.header("Access-Control-Allow-Origin", origin);
  context.header("Cache-Control", "no-store"); context.header("Vary", "Origin"); context.header("X-Content-Type-Options", "nosniff"); }
function invalid(context: Context) { return context.json({ error: "Invalid request" }, 400); }
function generic(context: Context, status: 409 | 429 | 500 | 503) { return context.json({ error: "Request could not be completed" }, status); }

function getClaimantUploadControllerConfigV1(): ClaimantUploadControllerConfigV1 | null {
  const apiOrigin = exactHttpsOrigin(process.env.CLAIMANT_UPLOAD_API_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(process.env.CLAIMANT_UPLOAD_PORTAL_ORIGIN);
  const capabilityDerivationKey = readKey(process.env.CLAIMANT_UPLOAD_CAPABILITY_DERIVATION_KEY);
  const controllerDerivationKey = readKey(process.env.CLAIMANT_UPLOAD_CONTROLLER_DERIVATION_KEY);
  const freshAssuranceSeconds = Number(process.env.CLAIMANT_FRESH_ASSURANCE_MAX_AGE_SECONDS?.trim() || "600");
  const processorUserId = uuid.safeParse(process.env.CLAIMANT_UPLOAD_PROCESSOR_USER_ID?.trim());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!apiOrigin || !claimantOrigin || !capabilityDerivationKey || !controllerDerivationKey
    || !processorUserId.success || !serviceRoleKey || !supabaseUrl || !Number.isInteger(freshAssuranceSeconds)
    || freshAssuranceSeconds < 60 || freshAssuranceSeconds > 600) return null;
  return { apiOrigin, capabilityDerivationKey, claimantOrigin, controllerDerivationKey,
    freshAssuranceSeconds, processorUserId: processorUserId.data, serviceRoleKey, supabaseUrl };
}
function exactHttpsOrigin(value: string | undefined): string | null { try { if (!value || value !== value.trim()) return null;
  const parsed = new URL(value); return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
    && !parsed.username && !parsed.password && !parsed.search && !parsed.hash ? parsed.origin : null; } catch { return null; } }
function readKey(value: string | undefined): Buffer | null { try { if (!value || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return null;
  const key = Buffer.from(value, "base64url"); return key.length === 32 ? key : null; } catch { return null; } }
