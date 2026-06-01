import type { AuditLog } from "./audit-log";
import {
  createSupabaseAuditEventRepository,
  type SupabaseAuditClient,
} from "./supabase-audit-event-repository";

export function configureDurableAuditLog({
  auditLog,
  client,
}: {
  auditLog: Pick<AuditLog, "setDurableSink">;
  client: SupabaseAuditClient | null;
}): boolean {
  if (!client) {
    return false;
  }

  auditLog.setDurableSink(createSupabaseAuditEventRepository(client));

  return true;
}
