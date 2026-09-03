import type { SyntheticEvidenceMediaType, SyntheticEvidencePlaceholderV1 } from "@vault/shared-types";

export const CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED = false as const;
export const CLAIMANT_EVIDENCE_UPLOAD_CLIENT_MAX_BYTES = 25 * 1024 * 1024;

export type EvidenceUploadProgressV1 = Readonly<{
  phase: "capability" | "uploading" | "reconciling" | "complete";
  sentBytes: number;
  totalBytes: number;
}>;

export type EvidenceUploadTerminalResultV1 = Readonly<{
  objectId: string;
  status: "clean" | "rejected" | "scan_failed";
  version: number;
}>;

type EvidenceUploadCapabilityV1 = Readonly<{
  capability: string;
  expiresAt: string;
  objectId: string;
  objectPath: string;
}>;

export type EvidenceUploadTransportV1 = Readonly<{
  issueCapability(input: Readonly<{
    caseId: string;
    expectedCaseVersion: number;
    expectedIntakeVersion: number;
    idempotencyKey: string;
    itemKey: SyntheticEvidencePlaceholderV1["checklist_item_key"];
    placeholderRef: string;
    preparationVersion: number;
    signal?: AbortSignal;
  }>): Promise<EvidenceUploadCapabilityV1>;
  reconcile(input: Readonly<{
    capability: string;
    caseId: string;
    idempotencyKey: string;
    objectId: string;
    signal?: AbortSignal;
  }>): Promise<EvidenceUploadTerminalResultV1 | Readonly<{ status: "upload_pending" }>>;
  upload(input: Readonly<{
    body: Uint8Array;
    capability: string;
    caseId: string;
    contentType: SyntheticEvidenceMediaType;
    idempotencyKey: string;
    objectId: string;
    onProgress: (sentBytes: number) => void;
    signal?: AbortSignal;
  }>): Promise<EvidenceUploadTerminalResultV1>;
}>;

export class EvidenceUploadCoordinatorError extends Error {
  constructor(readonly kind: "aborted" | "busy" | "disabled" | "failed" |
    "invalid_input" | "reconciliation_required") {
    super("Evidence upload could not be completed.");
    this.name = "EvidenceUploadCoordinatorError";
  }
}

export class EvidenceUploadTransportError extends Error {
  constructor(readonly kind: "aborted" | "authentication" | "conflict" |
    "invalid_response" | "rate_limited" | "unavailable") {
    super("Evidence upload request could not be completed.");
    this.name = "EvidenceUploadTransportError";
  }
}

type PendingUpload = Readonly<{
  capability: string;
  caseId: string;
  objectId: string;
  reconcileIdempotencyKey: string;
  totalBytes: number;
}>;

type CoordinatorInput = Readonly<{
  approved?: boolean;
  createIdempotencyKey: () => string;
  now?: () => Date;
  onProgress?: (progress: EvidenceUploadProgressV1) => void;
  transport: EvidenceUploadTransportV1;
}>;

export function createEvidenceUploadCoordinatorV1(input: CoordinatorInput) {
  let active = false;
  let pending: PendingUpload | null = null;
  const assertApproved = () => {
    if (!(input.approved ?? CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED)) {
      throw new EvidenceUploadCoordinatorError("disabled");
    }
  };
  return {
    hasPendingReconciliation: () => pending !== null,
    async retryReconciliation(signal?: AbortSignal) {
      assertApproved();
      if (active) throw new EvidenceUploadCoordinatorError("busy");
      if (!pending) return { status: "none" as const };
      active = true;
      try {
        const result = await reconcilePending(input, pending, signal);
        if (result.status === "upload_pending") {
          throw new EvidenceUploadCoordinatorError("reconciliation_required");
        }
        const totalBytes = pending.totalBytes;
        pending = null;
        progress(input, "complete", totalBytes, totalBytes);
        return { status: "completed" as const, result };
      } catch (error) {
        throw safeError(error, signal, true);
      } finally { active = false; }
    },
    async upload(value: Readonly<{
      body: Uint8Array;
      caseId: string;
      expectedCaseVersion: number;
      expectedIntakeVersion: number;
      placeholder: SyntheticEvidencePlaceholderV1;
      preparationVersion: number;
    }>, signal?: AbortSignal) {
      assertApproved();
      if (active) throw new EvidenceUploadCoordinatorError("busy");
      if (pending) throw new EvidenceUploadCoordinatorError("reconciliation_required");
      validateInput(value); active = true;
      const totalBytes = value.body.byteLength;
      try {
        activeSignal(signal); progress(input, "capability", 0, totalBytes);
        const capability = await input.transport.issueCapability({ caseId: value.caseId,
          expectedCaseVersion: value.expectedCaseVersion,
          expectedIntakeVersion: value.expectedIntakeVersion,
          idempotencyKey: requireUuid(input.createIdempotencyKey()),
          itemKey: value.placeholder.checklist_item_key,
          placeholderRef: value.placeholder.placeholder_ref,
          preparationVersion: value.preparationVersion, signal });
        validateCapability(capability, value.caseId, input.now?.() ?? new Date());
        pending = { capability: capability.capability, caseId: value.caseId,
          objectId: capability.objectId, reconcileIdempotencyKey: requireUuid(input.createIdempotencyKey()),
          totalBytes };
        let lastSent = 0;
        const result = await input.transport.upload({ body: value.body,
          capability: capability.capability, caseId: value.caseId,
          contentType: value.placeholder.media_type,
          idempotencyKey: requireUuid(input.createIdempotencyKey()), objectId: capability.objectId,
          onProgress(sentBytes) { lastSent = validateProgress(sentBytes, lastSent, totalBytes);
            progress(input, "uploading", lastSent, totalBytes); }, signal });
        validateTerminal(result, capability.objectId);
        activeSignal(signal); pending = null; progress(input, "complete", totalBytes, totalBytes);
        return result;
      } catch (error) {
        if (pending && shouldReconcile(error, signal)) {
          try {
            const result = await reconcilePending(input, pending, signal);
            if (result.status !== "upload_pending") {
              validateTerminal(result, pending.objectId); pending = null;
              progress(input, "complete", totalBytes, totalBytes); return result;
            }
          } catch (reconcileError) { throw safeError(reconcileError, signal, true); }
          throw new EvidenceUploadCoordinatorError("reconciliation_required");
        }
        if (!pending) throw safeError(error, signal, false);
        if (!isAborted(error, signal)) pending = null;
        throw safeError(error, signal, false);
      } finally { active = false; }
    },
  };
}

async function reconcilePending(input: CoordinatorInput, pending: PendingUpload, signal?: AbortSignal) {
  activeSignal(signal); progress(input, "reconciling", 0, pending.totalBytes);
  return input.transport.reconcile({ capability: pending.capability, caseId: pending.caseId,
    idempotencyKey: pending.reconcileIdempotencyKey, objectId: pending.objectId, signal });
}

function validateInput(value: Readonly<{ body: Uint8Array; caseId: string; expectedCaseVersion: number;
  expectedIntakeVersion: number; placeholder: SyntheticEvidencePlaceholderV1; preparationVersion: number }>) {
  if (!(value.body instanceof Uint8Array) || value.body.byteLength < 1
    || value.body.byteLength > CLAIMANT_EVIDENCE_UPLOAD_CLIENT_MAX_BYTES
    || value.body.byteLength !== value.placeholder.size_bytes || !uuid.test(value.caseId)
    || !positive(value.expectedCaseVersion) || !positive(value.expectedIntakeVersion)
    || value.preparationVersion !== value.expectedIntakeVersion
    || value.placeholder.synthetic_only !== true
    || value.placeholder.protocol !== "sanduqkin:claim:evidence-placeholder:v1"
    || !/^synthetic_evidence_[a-z0-9_]+$/u.test(value.placeholder.placeholder_ref)) {
    throw new EvidenceUploadCoordinatorError("invalid_input");
  }
}
function validateCapability(value: EvidenceUploadCapabilityV1, caseId: string, now: Date) {
  const expiry = Date.parse(value.expiresAt);
  if (!capability.test(value.capability) || !uuid.test(value.objectId)
    || value.objectPath !== `v1/${caseId}/${value.objectId}` || !Number.isFinite(expiry)
    || new Date(expiry).toISOString() !== value.expiresAt || expiry <= now.getTime()) invalidResponse();
}
function validateTerminal(value: EvidenceUploadTerminalResultV1, objectId: string) {
  if (value.objectId !== objectId || !["clean", "rejected", "scan_failed"].includes(value.status)
    || !positive(value.version)) invalidResponse();
}
function validateProgress(value: number, previous: number, total: number) {
  if (!Number.isSafeInteger(value) || value < previous || value > total) invalidResponse();
  return value;
}
function progress(input: CoordinatorInput, phase: EvidenceUploadProgressV1["phase"],
  sentBytes: number, totalBytes: number) { input.onProgress?.({ phase, sentBytes, totalBytes }); }
function shouldReconcile(error: unknown, signal?: AbortSignal) {
  if (isAborted(error, signal)) return false;
  return !(error instanceof EvidenceUploadTransportError)
    || ["conflict", "invalid_response", "unavailable"].includes(error.kind);
}
function isAborted(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || error instanceof EvidenceUploadTransportError && error.kind === "aborted";
}
function safeError(error: unknown, signal: AbortSignal | undefined, reconciliation: boolean) {
  if (isAborted(error, signal)) {
    return new EvidenceUploadCoordinatorError("aborted");
  }
  if (error instanceof EvidenceUploadCoordinatorError) return error;
  return new EvidenceUploadCoordinatorError(reconciliation ? "reconciliation_required" : "failed");
}
function activeSignal(signal?: AbortSignal) { if (signal?.aborted) throw new EvidenceUploadCoordinatorError("aborted"); }
function requireUuid(value: string) { if (!uuid.test(value)) throw new EvidenceUploadCoordinatorError("invalid_input"); return value; }
function positive(value: number) { return Number.isSafeInteger(value) && value > 0; }
function invalidResponse(): never { throw new EvidenceUploadTransportError("invalid_response"); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const capability = /^[A-Za-z0-9_-]{43}$/u;
