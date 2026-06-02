import { createClient } from "@supabase/supabase-js";

import type { AccountDeletionProcessorClient, AccountDeletionRequest } from "./processor.js";

type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type QueryBuilder<T = unknown> = PromiseLike<SupabaseResult<T>> & {
  delete: () => QueryBuilder<unknown>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  limit: (count: number) => Promise<SupabaseResult<AccountDeletionRequest[]>>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder<T>;
  select: (columns: string) => QueryBuilder<AccountDeletionRequest[]>;
  update: (values: Record<string, unknown>) => QueryBuilder<unknown>;
};

type SupabaseAdminClientLike = {
  auth: {
    admin: {
      deleteUser: (
        userId: string,
        shouldSoftDelete?: boolean,
      ) => Promise<SupabaseResult<unknown>>;
    };
  };
  from: (
    table: "account_deletion_requests" | "audit_events" | "vault_assets" | "vault_key_material",
  ) => QueryBuilder;
};

export function createServiceRoleSupabaseClient({
  serviceRoleKey,
  supabaseUrl,
}: {
  serviceRoleKey: string;
  supabaseUrl: string;
}): SupabaseAdminClientLike {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as SupabaseAdminClientLike;
}

export function createSupabaseAccountDeletionProcessorClient(
  supabase: SupabaseAdminClientLike,
): AccountDeletionProcessorClient {
  return {
    async anonymizeAuditEvents(userId) {
      const result = await supabase
        .from("audit_events")
        .update({
          user_id: null,
        })
        .eq("user_id", userId);
      assertNoError(result.error, "Audit events could not be anonymized.");
    },

    async deleteAuthUser(userId, shouldSoftDelete) {
      const result = await supabase.auth.admin.deleteUser(userId, shouldSoftDelete);
      assertNoError(result.error, "Auth user could not be deleted.");
    },

    async deleteVaultData(userId) {
      const assetResult = await supabase.from("vault_assets").delete().eq("user_id", userId);
      assertNoError(assetResult.error, "Vault assets could not be deleted.");

      const keyMaterialResult = await supabase
        .from("vault_key_material")
        .delete()
        .eq("user_id", userId);
      assertNoError(keyMaterialResult.error, "Vault key material could not be deleted.");
    },

    async markCompleted(requestId, completedAt = new Date().toISOString()) {
      const result = await supabase
        .from("account_deletion_requests")
        .update({
          completed_at: completedAt,
          last_error: null,
          status: "completed",
          updated_at: completedAt,
        })
        .eq("id", requestId);
      assertNoError(result.error, "Account deletion request could not be completed.");
    },

    async markFailed(requestId, errorMessage) {
      const result = await supabase
        .from("account_deletion_requests")
        .update({
          last_error: errorMessage,
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      assertNoError(result.error, "Account deletion request could not be marked failed.");
    },

    async markProcessing(requestId, nextAttemptCount = 1) {
      const result = await supabase
        .from("account_deletion_requests")
        .update({
          attempt_count: nextAttemptCount,
          last_error: null,
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "pending");
      assertNoError(result.error, "Account deletion request could not be marked processing.");
    },

    async selectDueRequests({ limit, scheduledBefore }) {
      const result = await supabase
        .from("account_deletion_requests")
        .select("id,user_id,status,scheduled_for,attempt_count")
        .eq("status", "pending")
        .lte("scheduled_for", scheduledBefore)
        .order("scheduled_for", { ascending: true })
        .limit(limit);
      assertNoError(result.error, "Account deletion requests could not be loaded.");

      return result.data;
    },
  };
}

function assertNoError(error: SupabaseError | null, fallbackMessage: string): void {
  if (error) {
    throw new Error(error.message ?? fallbackMessage);
  }
}
