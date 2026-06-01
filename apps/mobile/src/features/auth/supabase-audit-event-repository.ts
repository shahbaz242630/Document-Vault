import type { AuditEventType, DurableAuditEventInput } from "./audit-log";

type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type AuditEventRowInsert = {
  device_info: string;
  event_type: AuditEventType;
  metadata: Record<string, unknown>;
};

type AuditEventsTable = {
  insert: (values: AuditEventRowInsert) => Promise<SupabaseResult<null>>;
};

export type SupabaseAuditClient = {
  from: (table: "audit_events") => AuditEventsTable;
};

const PLAINTEXT_VAULT_METADATA_KEYS = new Set([
  "accountNumber",
  "ciphertext",
  "field",
  "fields",
  "institutionName",
  "nonce",
  "notes",
  "title",
]);

export function createSupabaseAuditEventRepository(client: SupabaseAuditClient) {
  const table = client.from("audit_events");

  return {
    async recordEvent(input: DurableAuditEventInput): Promise<void> {
      const metadata = input.metadata ?? {};

      assertSafeMetadata(metadata);

      const result = await table.insert({
        device_info: input.deviceInfo,
        event_type: input.eventType,
        metadata,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Audit event could not be saved.");
      }
    },
  };
}

function assertSafeMetadata(metadata: Record<string, unknown>): void {
  const keys = collectMetadataKeys(metadata);

  for (const key of keys) {
    if (PLAINTEXT_VAULT_METADATA_KEYS.has(key)) {
      throw new Error("Audit metadata contains plaintext vault payload fields.");
    }
  }
}

function collectMetadataKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectMetadataKeys);
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => [
    key,
    ...collectMetadataKeys(nested),
  ]);
}
