export type AuditEventType =
  | "sign_in_attempt"
  | "sign_in_success"
  | "sign_in_failure"
  | "sign_up_attempt"
  | "sign_up_success"
  | "vault_unlocked"
  | "vault_locked"
  | "vault_pdf_export_created"
  | "sealed_emergency_code_created"
  | "sealed_emergency_code_revoked"
  | "sealed_emergency_code_regenerated"
  | "biometric_unlock_enabled"
  | "biometric_unlock_disabled"
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

export type DurableAuditEventInput = {
  deviceInfo: string;
  eventType: AuditEventType;
  metadata?: Record<string, unknown>;
};

export type DurableAuditSink = {
  recordEvent: (input: DurableAuditEventInput) => Promise<void>;
};

export type AuditLog = {
  readonly events: readonly AuditEvent[];
  anonymize: () => void;
  log: (input: Omit<AuditEvent, "id" | "timestamp">) => void;
  setDurableSink: (sink: DurableAuditSink | null) => void;
};

export function createAuditLog(options?: { durableSink?: DurableAuditSink | null }): AuditLog {
  const events: AuditEvent[] = [];
  let nextId = 1;
  let durableSink = options?.durableSink ?? null;

  return {
    get events(): readonly AuditEvent[] {
      return [...events];
    },

    log(input: Omit<AuditEvent, "id" | "timestamp">): void {
      const event = {
        ...input,
        id: `audit-${Date.now()}-${nextId++}`,
        timestamp: new Date().toISOString(),
      };
      events.push(event);

      if (durableSink) {
        void durableSink
          .recordEvent({
            deviceInfo: event.deviceInfo,
            eventType: event.eventType,
            metadata: event.metadata,
          })
          .catch(() => {
            // Durable audit persistence must not block or break local security flows.
          });
      }
    },

    anonymize(): void {
      for (const event of events) {
        (event as { userEmail?: string }).userEmail = undefined;
      }
    },

    setDurableSink(sink: DurableAuditSink | null): void {
      durableSink = sink;
    },
  };
}

/**
 * Default singleton for app-wide use.
 * Replace with a context/provider when scaling to multi-user or server sync.
 */
export const defaultAuditLog = createAuditLog();
