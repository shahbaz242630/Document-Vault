import { createClient } from "@supabase/supabase-js";
import type { ClaimantChecklistItemKey, SyntheticEvidenceMediaType } from "@vault/shared-types";
import { z } from "zod";

type RpcResult = PromiseLike<Readonly<{ data: unknown; error: Readonly<{ code?: string }> | null }>>;
type Rpc = (name: string, input: Record<string, unknown>) => RpcResult;

export type QuarantineScanResult = "clean" | "malicious" | "error" | "timeout";
export type PrivateQuarantineTransactionClientV1 = Readonly<{
  issue(input: Readonly<{ capabilityDigest: string; caseId: string; claimantUserId: string;
    expectedCaseVersion: number; expectedIntakeVersion: number; expiresAt: string;
    idempotencyKey: string; itemKey: ClaimantChecklistItemKey; objectId: string;
    objectPath: string; placeholderRef: string; portalSessionId: string;
    preparationVersion: number }>): Promise<Readonly<{ caseId: string; expiresAt: string;
      objectId: string; objectPath: string; replayed: boolean }>>;
  quarantine(input: Readonly<{ archiveEntryCount: number; capabilityDigest: string;
    contentDigest: string; deleteAfter: string; detectedMediaType: SyntheticEvidenceMediaType;
    expandedSizeBytes: number; idempotencyKey: string; objectId: string; objectPath: string;
    pageCount: number | null; processorUserId: string; sizeBytes: number }>): Promise<LifecycleResult>;
  scan(input: Readonly<{ expectedVersion: number; idempotencyKey: string; objectId: string;
    processorUserId: string; scanResult: QuarantineScanResult }>): Promise<LifecycleResult>;
  planDeletion(input: Readonly<{ expectedVersion: number; idempotencyKey: string; objectId: string;
    processorUserId: string }>): Promise<LifecycleResult>;
  confirmDeleted(input: Readonly<{ expectedVersion: number; idempotencyKey: string; objectId: string;
    processorUserId: string }>): Promise<LifecycleResult>;
}>;

type LifecycleResult = Readonly<{ caseId: string; objectId: string; replayed: boolean;
  status: "quarantined" | "clean" | "rejected" | "scan_failed" | "deletion_pending" | "deleted";
  version: number }>;

export class PrivateQuarantineTransactionError extends Error {
  constructor(readonly code: string | undefined) {
    super("Private quarantine transaction failed."); this.name = "PrivateQuarantineTransactionError";
  }
}

export function createPrivateQuarantineTransactionClientV1(rpc: Rpc): PrivateQuarantineTransactionClientV1 {
  const call = async (name: string, args: Record<string, unknown>, schema: z.ZodType) => {
    const result = await rpc(name, args);
    if (result.error) throw new PrivateQuarantineTransactionError(result.error.code);
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) throw new Error("Private quarantine transaction returned an invalid result.");
    return parsed.data as Record<string, unknown>;
  };
  return {
    async issue(value) {
      const data = await call("claimant_issue_evidence_upload_capability", {
        p_capability_digest: value.capabilityDigest, p_case_id: value.caseId,
        p_claimant_user_id: value.claimantUserId, p_expected_case_version: value.expectedCaseVersion,
        p_expected_intake_version: value.expectedIntakeVersion, p_expires_at: value.expiresAt,
        p_idempotency_key: value.idempotencyKey, p_item_key: value.itemKey,
        p_object_id: value.objectId, p_object_path: value.objectPath,
        p_placeholder_ref: value.placeholderRef, p_portal_session_id: value.portalSessionId,
        p_preparation_version: value.preparationVersion,
      }, issueSchema);
      return { caseId: data.case_id as string, expiresAt: data.expires_at as string,
        objectId: data.object_id as string, objectPath: data.object_path as string,
        replayed: data.replayed as boolean };
    },
    async quarantine(value) {
      return mapLifecycle(await call("claimant_record_evidence_quarantine", {
        p_archive_entry_count: value.archiveEntryCount, p_capability_digest: value.capabilityDigest,
        p_content_digest: value.contentDigest, p_delete_after: value.deleteAfter,
        p_detected_media_type: value.detectedMediaType, p_expanded_size_bytes: value.expandedSizeBytes,
        p_idempotency_key: value.idempotencyKey, p_object_id: value.objectId,
        p_object_path: value.objectPath, p_page_count: value.pageCount,
        p_processor_user_id: value.processorUserId, p_size_bytes: value.sizeBytes,
      }, lifecycleSchema));
    },
    async scan(value) {
      return mapLifecycle(await call("claimant_record_evidence_scan", {
        p_expected_version: value.expectedVersion, p_idempotency_key: value.idempotencyKey,
        p_object_id: value.objectId, p_processor_user_id: value.processorUserId,
        p_scan_result: value.scanResult,
      }, lifecycleSchema));
    },
    async planDeletion(value) {
      return mapLifecycle(await call("claimant_plan_evidence_deletion", {
        p_expected_version: value.expectedVersion, p_idempotency_key: value.idempotencyKey,
        p_object_id: value.objectId, p_processor_user_id: value.processorUserId,
      }, lifecycleSchema));
    },
    async confirmDeleted(value) {
      return mapLifecycle(await call("claimant_confirm_evidence_deleted", {
        p_expected_version: value.expectedVersion, p_idempotency_key: value.idempotencyKey,
        p_object_id: value.objectId, p_processor_user_id: value.processorUserId,
      }, lifecycleSchema));
    },
  };
}

export function createPrivateQuarantineSupabaseTransactionClientV1(config: Readonly<{
  serviceRoleKey: string; supabaseUrl: string;
}>): PrivateQuarantineTransactionClientV1 {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createPrivateQuarantineTransactionClientV1((name, input) => supabase.rpc(name, input));
}

function mapLifecycle(data: Record<string, unknown>): LifecycleResult {
  return { caseId: data.case_id as string, objectId: data.object_id as string,
    replayed: data.replayed as boolean, status: data.status as LifecycleResult["status"],
    version: data.version as number };
}
const issueSchema = z.strictObject({ case_id: z.string().uuid(), expires_at: z.string().datetime({ offset: true }),
  object_id: z.string().uuid(), object_path: z.string().regex(/^v1\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/u),
  replayed: z.boolean() });
const lifecycleSchema = z.strictObject({ case_id: z.string().uuid(), object_id: z.string().uuid(),
  replayed: z.boolean(), status: z.enum(["quarantined", "clean", "rejected", "scan_failed",
    "deletion_pending", "deleted"]),
  version: z.number().int().positive() });
