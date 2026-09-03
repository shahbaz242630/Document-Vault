import { createHash } from "node:crypto";
import type { SyntheticEvidenceMediaType } from "@vault/shared-types";

import {
  CLAIMANT_QUARANTINE_BUCKET,
  scanQuarantinedEvidenceV1,
  validateEvidenceInspectionV1,
  type EvidenceInspectionV1,
  type MalwareScannerAdapterV1,
} from "./private-quarantine-service.js";
import type { PrivateQuarantineTransactionClientV1,
  UploadReconciliationAuthorityV1 } from "./private-quarantine-transaction-client.js";

export const CLAIMANT_UPLOAD_PROCESSOR_APPROVED = false as const;
export const CLAIMANT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
export const CLAIMANT_UPLOAD_MAX_CHUNK_BYTES = 1024 * 1024;
export const CLAIMANT_UPLOAD_MAX_DURATION_MS = 30_000;

export type QuarantineStorageProcessorAdapterV1 = Readonly<{
  exists(input: Readonly<{ bucket: typeof CLAIMANT_QUARANTINE_BUCKET; objectPath: string }> ):
    Promise<boolean>;
  put(input: Readonly<{ body: AsyncIterable<Uint8Array>; bucket: typeof CLAIMANT_QUARANTINE_BUCKET;
    contentType: SyntheticEvidenceMediaType; objectPath: string; signal: AbortSignal }> ): Promise<void>;
  remove(input: Readonly<{ bucket: typeof CLAIMANT_QUARANTINE_BUCKET; objectPath: string }> ):
    Promise<void>;
}>;

export type StoredEvidenceInspectorAdapterV1 = Readonly<{
  inspect(input: Readonly<{ bucket: typeof CLAIMANT_QUARANTINE_BUCKET; objectPath: string }> ):
    Promise<Omit<EvidenceInspectionV1, "contentDigest" | "sizeBytes">>;
}>;

export class ClaimantUploadProcessorError extends Error {
  constructor(readonly kind: "disabled" | "invalid_request" | "upload_failed" |
    "reconciliation_required") {
    super("Claimant evidence upload is unavailable."); this.name = "ClaimantUploadProcessorError";
  }
}

type ProcessorDependencies = Readonly<{ approved?: boolean; inspector: StoredEvidenceInspectorAdapterV1;
  scanner: MalwareScannerAdapterV1; storage: QuarantineStorageProcessorAdapterV1;
  transactions: PrivateQuarantineTransactionClientV1 }>;

type StoredContext = Readonly<{ capabilityDigest: string; caseId: string; contentDigest: string;
  cleanupIdempotencyKey: string; deleteAfter: string; expectedMediaType: SyntheticEvidenceMediaType; expectedSizeBytes: number;
  objectId: string; objectPath: string; processorUserId: string; quarantineIdempotencyKey: string;
  scanIdempotencyKey: string }>;

export function createClaimantUploadProcessorV1(dependencies: ProcessorDependencies) {
  const assertApproved = () => {
    if (!(dependencies.approved ?? CLAIMANT_UPLOAD_PROCESSOR_APPROVED)) {
      throw new ClaimantUploadProcessorError("disabled");
    }
  };
  return {
    async upload(value: Readonly<{ body: AsyncIterable<Uint8Array>; capabilityToken: string;
      caseId: string; cleanupIdempotencyKey: string; deleteAfter: string; expectedMediaType: SyntheticEvidenceMediaType;
      expectedSizeBytes: number; objectId: string; objectPath: string; processorUserId: string;
      quarantineIdempotencyKey: string; scanIdempotencyKey: string }>) {
      assertApproved();
      const capabilityDigest = capabilityDigestOf(value.capabilityToken);
      validatePath(value.caseId, value.objectId, value.objectPath);
      const authority = await dependencies.transactions.reconcile({ capabilityDigest,
        objectId: value.objectId });
      assertAuthorityBinding(authority, value.caseId, value.objectId, value.objectPath);
      if (authority.expectedMediaType !== value.expectedMediaType
        || authority.expectedSizeBytes !== value.expectedSizeBytes) {
        throw new ClaimantUploadProcessorError("invalid_request");
      }
      if (authority.authority === "object_recorded") {
        return settleRecordedObject(dependencies, authority, value.processorUserId,
          value.scanIdempotencyKey);
      }
      if (authority.authority !== "upload_pending" || authority.capabilityStatus !== "issued") {
        throw new ClaimantUploadProcessorError("reconciliation_required");
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLAIMANT_UPLOAD_MAX_DURATION_MS);
      const observed = { bytes: 0, digest: createHash("sha256") };
      try {
        await dependencies.storage.put({ body: boundBody(value.body, value.expectedSizeBytes,
          observed, controller.signal), bucket: CLAIMANT_QUARANTINE_BUCKET,
          contentType: value.expectedMediaType, objectPath: value.objectPath, signal: controller.signal });
        if (observed.bytes !== value.expectedSizeBytes) throw new ClaimantUploadProcessorError("invalid_request");
      } catch (error) {
        await abandonAndCleanup(dependencies, { capabilityDigest, caseId: value.caseId,
          cleanupIdempotencyKey: value.cleanupIdempotencyKey, objectId: value.objectId,
          objectPath: value.objectPath, processorUserId: value.processorUserId }, error);
      } finally {
        clearTimeout(timeout);
      }
      const context: StoredContext = { ...value, capabilityDigest,
        contentDigest: observed.digest.digest("hex") };
      return settleStoredObject(dependencies, context);
    },
    async reconcile(value: Readonly<{ capabilityToken: string; caseId: string; deleteAfter: string;
      cleanupIdempotencyKey: string; objectId: string; objectPath: string; processorUserId: string;
      quarantineIdempotencyKey: string; scanIdempotencyKey: string }>) {
      assertApproved();
      const capabilityDigest = capabilityDigestOf(value.capabilityToken);
      validatePath(value.caseId, value.objectId, value.objectPath);
      const authority = await dependencies.transactions.reconcile({ capabilityDigest,
        objectId: value.objectId });
      assertAuthorityBinding(authority, value.caseId, value.objectId, value.objectPath);
      if (authority.authority === "object_recorded") {
        return settleRecordedObject(dependencies, authority, value.processorUserId,
          value.scanIdempotencyKey);
      }
      const exists = await dependencies.storage.exists({ bucket: CLAIMANT_QUARANTINE_BUCKET,
        objectPath: value.objectPath });
      if (!exists) return { status: authority.authority } as const;
      if (authority.authority === "upload_uncommitted") {
        await abandonAndCleanup(dependencies, { capabilityDigest, caseId: value.caseId,
          cleanupIdempotencyKey: value.cleanupIdempotencyKey, objectId: value.objectId,
          objectPath: value.objectPath, processorUserId: value.processorUserId },
        new ClaimantUploadProcessorError("upload_failed"));
      }
      throw new ClaimantUploadProcessorError("reconciliation_required");
    },
  };
}

async function settleStoredObject(dependencies: ProcessorDependencies, value: StoredContext) {
  let inspection: EvidenceInspectionV1;
  try {
    inspection = validateEvidenceInspectionV1({ mediaType: value.expectedMediaType,
      sizeBytes: value.expectedSizeBytes }, { ...(await dependencies.inspector.inspect({
        bucket: CLAIMANT_QUARANTINE_BUCKET, objectPath: value.objectPath })),
      contentDigest: value.contentDigest, sizeBytes: value.expectedSizeBytes });
  } catch (error) {
    await abandonAndCleanup(dependencies, value, error);
  }
  let recorded;
  try {
    recorded = await dependencies.transactions.quarantine({
      archiveEntryCount: inspection!.archiveEntryCount, capabilityDigest: value.capabilityDigest,
      contentDigest: value.contentDigest, deleteAfter: value.deleteAfter,
      detectedMediaType: inspection!.detectedMediaType,
      expandedSizeBytes: inspection!.expandedSizeBytes,
      idempotencyKey: value.quarantineIdempotencyKey, objectId: value.objectId,
      objectPath: value.objectPath, pageCount: inspection!.pageCount,
      processorUserId: value.processorUserId, sizeBytes: value.expectedSizeBytes,
    });
  } catch {
    let authority: UploadReconciliationAuthorityV1;
    try {
      authority = await dependencies.transactions.reconcile({ capabilityDigest: value.capabilityDigest,
        objectId: value.objectId });
      assertAuthorityBinding(authority, value.caseId, value.objectId, value.objectPath);
    } catch {
      throw new ClaimantUploadProcessorError("reconciliation_required");
    }
    if (authority.authority === "object_recorded") {
      return settleRecordedObject(dependencies, authority, value.processorUserId,
        value.scanIdempotencyKey);
    }
    await abandonAndCleanup(dependencies, value, new ClaimantUploadProcessorError("upload_failed"));
  }
  return scanAndRecord(dependencies, value.objectPath, value.objectId, recorded!.version,
    value.processorUserId, value.scanIdempotencyKey);
}

async function settleRecordedObject(dependencies: ProcessorDependencies,
  authority: UploadReconciliationAuthorityV1, processorUserId: string, scanIdempotencyKey: string) {
  if (authority.objectStatus === "quarantined" || authority.objectStatus === "scan_failed") {
    return scanAndRecord(dependencies, authority.objectPath, authority.objectId,
      authority.objectVersion!, processorUserId, scanIdempotencyKey);
  }
  return { objectId: authority.objectId, status: authority.objectStatus,
    version: authority.objectVersion };
}

async function scanAndRecord(dependencies: ProcessorDependencies, objectPath: string, objectId: string,
  expectedVersion: number, processorUserId: string, idempotencyKey: string) {
  const scanResult = await scanQuarantinedEvidenceV1({ objectPath, scanner: dependencies.scanner });
  try {
    return await dependencies.transactions.scan({ expectedVersion, idempotencyKey, objectId,
      processorUserId, scanResult });
  } catch {
    throw new ClaimantUploadProcessorError("reconciliation_required");
  }
}

async function cleanupOrRequireReconciliation(storage: QuarantineStorageProcessorAdapterV1,
  objectPath: string, original: unknown): Promise<never> {
  try {
    await storage.remove({ bucket: CLAIMANT_QUARANTINE_BUCKET, objectPath });
  } catch {
    throw new ClaimantUploadProcessorError("reconciliation_required");
  }
  throw original instanceof ClaimantUploadProcessorError
    ? original : new ClaimantUploadProcessorError("upload_failed");
}

async function abandonAndCleanup(dependencies: ProcessorDependencies, value: Readonly<{
  capabilityDigest: string; caseId: string; cleanupIdempotencyKey: string; objectId: string;
  objectPath: string; processorUserId: string }>, original: unknown): Promise<never> {
  try {
    const abandoned = await dependencies.transactions.abandon({
      capabilityDigest: value.capabilityDigest, idempotencyKey: value.cleanupIdempotencyKey,
      objectId: value.objectId, processorUserId: value.processorUserId });
    if (abandoned.caseId !== value.caseId || abandoned.objectId !== value.objectId
      || abandoned.objectPath !== value.objectPath || abandoned.status !== "abandoned") {
      throw new Error("abandonment binding failed");
    }
  } catch {
    throw new ClaimantUploadProcessorError("reconciliation_required");
  }
  return cleanupOrRequireReconciliation(dependencies.storage, value.objectPath, original);
}

async function* boundBody(body: AsyncIterable<Uint8Array>, expectedSize: number,
  observed: { bytes: number; digest: ReturnType<typeof createHash> }, signal: AbortSignal) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > CLAIMANT_UPLOAD_MAX_BYTES) {
    throw new ClaimantUploadProcessorError("invalid_request");
  }
  for await (const chunk of body) {
    if (signal.aborted || !(chunk instanceof Uint8Array) || chunk.byteLength < 1
      || chunk.byteLength > CLAIMANT_UPLOAD_MAX_CHUNK_BYTES) {
      throw new ClaimantUploadProcessorError("invalid_request");
    }
    observed.bytes += chunk.byteLength;
    if (observed.bytes > expectedSize || observed.bytes > CLAIMANT_UPLOAD_MAX_BYTES) {
      throw new ClaimantUploadProcessorError("invalid_request");
    }
    observed.digest.update(chunk);
    yield chunk;
  }
}

function capabilityDigestOf(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(token)) throw new ClaimantUploadProcessorError("invalid_request");
  return createHash("sha256").update(token).digest("hex");
}
function validatePath(caseId: string, objectId: string, objectPath: string) {
  if (objectPath !== `v1/${caseId}/${objectId}`) throw new ClaimantUploadProcessorError("invalid_request");
}
function assertAuthorityBinding(authority: UploadReconciliationAuthorityV1, caseId: string,
  objectId: string, objectPath: string) {
  if (authority.caseId !== caseId || authority.objectId !== objectId
    || authority.objectPath !== objectPath) throw new ClaimantUploadProcessorError("reconciliation_required");
}
