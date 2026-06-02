import { createClient } from "@supabase/supabase-js";

import type { AuditRetentionProcessorClient } from "./processor.js";

type SupabaseError = {
  message?: string;
};

type SupabaseResult = {
  count: number | null;
  data: null;
  error: SupabaseError | null;
};

type AuditEventsQueryBuilder = {
  delete: () => AuditEventsQueryBuilder;
  is: (column: string, value: unknown) => AuditEventsQueryBuilder;
  lt: (column: string, value: unknown) => AuditEventsQueryBuilder;
  select: (
    columns: string,
    options: { count: "exact"; head: true },
  ) => Promise<SupabaseResult>;
};

type SupabaseAdminClientLike = {
  from: (table: "audit_events") => AuditEventsQueryBuilder;
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

export function createSupabaseAuditRetentionProcessorClient(
  supabase: SupabaseAdminClientLike,
): AuditRetentionProcessorClient {
  return {
    async deleteAnonymizedBefore(occurredBefore) {
      const result = await supabase
        .from("audit_events")
        .delete()
        .is("user_id", null)
        .lt("occurred_at", occurredBefore)
        .select("id", { count: "exact", head: true });

      if (result.error) {
        throw new Error(result.error.message ?? "Expired audit events could not be deleted.");
      }

      return result.count ?? 0;
    },
  };
}
