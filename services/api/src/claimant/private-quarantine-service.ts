import { createHash, createHmac } from "node:crypto";
import type { ClaimantChecklistItemKey, SyntheticEvidenceMediaType } from "@vault/shared-types";

import type { PrivateQuarantineTransactionClientV1, QuarantineScanResult } from
  "./private-quarantine-transaction-client.js";

export const CLAIMANT_PRIVATE_QUARANTINE_APPROVED = false as const;
export const CLAIMANT_QUARANTINE_BUCKET = "claimant-evidence-quarantine-v1" as const;
export const CLAIMANT_UPLOAD_CAPABILITY_TTL_SECONDS = 300 as const;

export class PrivateQuarantineServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_inspection") {
    super("Private evidence quarantine is unavailable."); this.name = "PrivateQuarantineServiceError";
  }
}

export function createPrivateQuarantineCapabilityServiceV1(input: Readonly<{
  approved?: boolean; capabilityDerivationKey: Buffer;
  transactions: PrivateQuarantineTransactionClientV1;
}>) {
  return { async issue(value: Readonly<{ caseId: string; claimantUserId: string;
    expectedCaseVersion: number; expectedIntakeVersion: number; idempotencyKey: string;
    issuedAt: string;
    itemKey: ClaimantChecklistItemKey; placeholderRef: string; portalSessionId: string;
    preparationVersion: number }>) {
    if (!(input.approved ?? CLAIMANT_PRIVATE_QUARANTINE_APPROVED)) {
      throw new PrivateQuarantineServiceError("disabled");
    }
    if (input.capabilityDerivationKey.length !== 32) {
      throw new PrivateQuarantineServiceError("disabled");
    }
    const issuedAt = Date.parse(value.issuedAt);
    if (!Number.isFinite(issuedAt) || new Date(issuedAt).toISOString() !== value.issuedAt) {
      throw new PrivateQuarantineServiceError("disabled");
    }
    const binding = `${value.claimantUserId}|${value.caseId}|${value.preparationVersion}|${value.itemKey}`
      + `|${value.placeholderRef}|${value.idempotencyKey}`;
    const objectId = uuidFromDigest(createHmac("sha256", input.capabilityDerivationKey)
      .update(`sanduqkin:claim:quarantine-object:v1|${binding}`).digest());
    const capabilityToken = createHmac("sha256", input.capabilityDerivationKey)
      .update(`sanduqkin:claim:upload-capability:v1|${binding}`).digest("base64url");
    const capabilityDigest = createHash("sha256").update(capabilityToken).digest("hex");
    const objectPath = `v1/${value.caseId}/${objectId}`;
    const expiresAt = new Date(issuedAt + CLAIMANT_UPLOAD_CAPABILITY_TTL_SECONDS * 1000).toISOString();
    const result = await input.transactions.issue({ ...value, capabilityDigest, expiresAt,
      objectId, objectPath });
    if (result.objectId !== objectId || result.objectPath !== objectPath
      || Date.parse(result.expiresAt) !== Date.parse(expiresAt)) {
      throw new Error("Private quarantine capability binding failed.");
    }
    return { ...result, bucket: CLAIMANT_QUARANTINE_BUCKET, capabilityToken };
  } };
}

function uuidFromDigest(value: Buffer): string {
  const bytes = Buffer.from(value.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type EvidenceInspectionV1 = Readonly<{ archiveEntryCount: number; contentDigest: string;
  detectedMediaType: SyntheticEvidenceMediaType; expandedSizeBytes: number; pageCount: number | null;
  signatureValid: boolean; sizeBytes: number }>;

export function validateEvidenceInspectionV1(expected: Readonly<{
  mediaType: SyntheticEvidenceMediaType; sizeBytes: number;
}>, inspection: EvidenceInspectionV1): EvidenceInspectionV1 {
  const pdfPagesValid = inspection.detectedMediaType === "application/pdf"
    ? Number.isInteger(inspection.pageCount) && inspection.pageCount! >= 1 && inspection.pageCount! <= 50
    : inspection.pageCount === null;
  if (!inspection.signatureValid || inspection.detectedMediaType !== expected.mediaType
    || inspection.sizeBytes !== expected.sizeBytes || inspection.sizeBytes < 1
    || inspection.sizeBytes > 25 * 1024 * 1024 || !/^[0-9a-f]{64}$/u.test(inspection.contentDigest)
    || !pdfPagesValid || inspection.archiveEntryCount !== 1
    || !Number.isSafeInteger(inspection.expandedSizeBytes) || inspection.expandedSizeBytes < 1
    || inspection.expandedSizeBytes > 100 * 1024 * 1024) {
    throw new PrivateQuarantineServiceError("invalid_inspection");
  }
  return inspection;
}

export type MalwareScannerAdapterV1 = Readonly<{
  scan(input: Readonly<{ bucket: typeof CLAIMANT_QUARANTINE_BUCKET; objectPath: string }>):
    Promise<QuarantineScanResult>;
}>;

export async function scanQuarantinedEvidenceV1(input: Readonly<{
  objectPath: string; scanner: MalwareScannerAdapterV1;
}>): Promise<QuarantineScanResult> {
  try {
    const result = await input.scanner.scan({ bucket: CLAIMANT_QUARANTINE_BUCKET,
      objectPath: input.objectPath });
    return (["clean", "malicious", "error", "timeout"] as const).includes(result) ? result : "error";
  } catch {
    return "error";
  }
}

export type PrivateQuarantineStorageAdapterV1 = Readonly<{
  remove(input: Readonly<{ bucket: typeof CLAIMANT_QUARANTINE_BUCKET; objectPath: string }>): Promise<void>;
}>;

export async function deleteQuarantinedEvidenceV1(input: Readonly<{
  confirmIdempotencyKey: string; expectedVersion: number; objectId: string; objectPath: string;
  planIdempotencyKey: string; processorUserId: string; storage: PrivateQuarantineStorageAdapterV1;
  transactions: PrivateQuarantineTransactionClientV1;
}>) {
  const planned = await input.transactions.planDeletion({ expectedVersion: input.expectedVersion,
    idempotencyKey: input.planIdempotencyKey, objectId: input.objectId,
    processorUserId: input.processorUserId });
  if (planned.status !== "deletion_pending") throw new Error("Evidence deletion was not planned.");
  await input.storage.remove({ bucket: CLAIMANT_QUARANTINE_BUCKET, objectPath: input.objectPath });
  return input.transactions.confirmDeleted({ expectedVersion: planned.version,
    idempotencyKey: input.confirmIdempotencyKey, objectId: input.objectId,
    processorUserId: input.processorUserId });
}
