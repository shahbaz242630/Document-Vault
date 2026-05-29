export type AuditEventType =
  | "sign_in_attempt"
  | "sign_in_success"
  | "sign_in_failure"
  | "sign_up_attempt"
  | "sign_up_success"
  | "vault_unlocked"
  | "vault_locked"
  | "asset_created"
  | "asset_updated"
  | "asset_soft_deleted"
  | "asset_restored"
  | "asset_permanently_deleted"
  | "account_deletion_requested"
  | "account_deletion_completed";

export type AuditEvent = {
  deviceInfo: string;
  eventType: AuditEventType;
  id: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  userEmail?: string;
};

export type AuditLog = {
  readonly events: readonly AuditEvent[];
  anonymize: () => void;
  log: (input: Omit<AuditEvent, "id" | "timestamp">) => void;
};

export function createAuditLog(): AuditLog {
  const events: AuditEvent[] = [];
  let nextId = 1;

  return {
    get events(): readonly AuditEvent[] {
      return [...events];
    },

    log(input: Omit<AuditEvent, "id" | "timestamp">): void {
      events.push({
        ...input,
        id: `audit-${Date.now()}-${nextId++}`,
        timestamp: new Date().toISOString(),
      });
    },

    anonymize(): void {
      for (const event of events) {
        (event as { userEmail?: string }).userEmail = undefined;
      }
    },
  };
}

/**
 * Default singleton for app-wide use.
 * Replace with a context/provider when scaling to multi-user or server sync.
 */
export const defaultAuditLog = createAuditLog();
