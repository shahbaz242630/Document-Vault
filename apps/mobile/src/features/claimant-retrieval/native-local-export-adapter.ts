import { z } from "zod";

import type { NativeLocalExportAdapterV1 } from "./native-local-export-coordinator";

export const CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED = false as const;

export type ClaimantLocalExportNativeV1 = Readonly<{
  exportOpenedPackageAsync(input: Readonly<{ asset_count: number; case_id: string;
    completion_id: string; delivery_id: string; expires_at: string;
    interaction_id: string; open_session_reference: string;
    release_package_id: string; requested_at: string; retrieval_session_id: string;
    require_explicit_confirmation: true; require_fresh_user_presence: true }>): Promise<unknown>;
}>;

export class NativeLocalExportAdapterError extends Error {
  constructor(readonly kind: "disabled" | "failed" | "invalid_response") {
    super("Native local export is unavailable."); this.name = "NativeLocalExportAdapterError";
  }
}

export function createNativeLocalExportAdapterV1(input: Readonly<{
  approved?: boolean; native: ClaimantLocalExportNativeV1 | null;
}>): NativeLocalExportAdapterV1 {
  return { async exportLocalCopy(value) {
    if (!(input.approved ?? CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED))
      throw new NativeLocalExportAdapterError("disabled");
    if (!input.native) throw new NativeLocalExportAdapterError("failed");
    try {
      const result = await input.native.exportOpenedPackageAsync({
        asset_count: value.assetCount, case_id: value.caseId,
        completion_id: value.completionId, delivery_id: value.deliveryId,
        expires_at: value.expiresAt, interaction_id: value.interactionId,
        open_session_reference: value.openSessionReference,
        release_package_id: value.releasePackageId, requested_at: value.requestedAt,
        retrieval_session_id: value.retrievalSessionId,
        require_explicit_confirmation: true, require_fresh_user_presence: true,
      });
      const parsed = nativeResultSchema.safeParse(result);
      if (!parsed.success) throw new NativeLocalExportAdapterError("invalid_response");
      return parsed.data;
    } catch (error) {
      if (error instanceof NativeLocalExportAdapterError) throw error;
      throw new NativeLocalExportAdapterError("failed");
    }
  } };
}

const uuid = z.string().uuid();
const nativeResultSchema = z.strictObject({ asset_count: z.number().int().min(1).max(100),
  authenticated_at: z.string().datetime({ offset: true }), case_id: uuid,
  closure_recorded: z.literal(false), completion_id: uuid, delivery_id: uuid,
  destination_class: z.literal("user_selected_local_copy"),
  explicit_confirmation_verified: z.literal(true), export_receipt_reference: z.string()
    .regex(/^claimant-local-export\.v1\.[0-9a-f-]{36}$/u),
  exported_at: z.string().datetime({ offset: true }), interaction_id: uuid,
  local_copy_created: z.literal(true), open_session_reference: z.string()
    .regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u),
  plaintext_returned_to_javascript: z.literal(false), release_package_id: uuid,
  retrieval_session_id: uuid, server_upload_performed: z.literal(false),
  status: z.literal("exported"), user_presence_verified: z.literal(true) });
