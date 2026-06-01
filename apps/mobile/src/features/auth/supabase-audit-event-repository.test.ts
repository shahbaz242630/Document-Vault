import { describe, expect, it } from "vitest";

import { createSupabaseAuditEventRepository, type SupabaseAuditClient } from "./supabase-audit-event-repository";

describe("supabase audit event repository", () => {
  it("inserts safe audit event fields and lets the database assign owner and timestamp", async () => {
    const table = createAuditTableDouble();
    const repository = createSupabaseAuditEventRepository({ from: table.from });

    await repository.recordEvent({
      deviceInfo: "React Native",
      eventType: "asset_created",
      metadata: { assetId: "asset-1", assetType: "passport" },
    });

    expect(table.calls).toEqual([
      {
        method: "insert",
        table: "audit_events",
        values: {
          device_info: "React Native",
          event_type: "asset_created",
          metadata: { assetId: "asset-1", assetType: "passport" },
        },
      },
    ]);
  });

  it("rejects plaintext vault payload fields in metadata", async () => {
    const table = createAuditTableDouble();
    const repository = createSupabaseAuditEventRepository({ from: table.from });

    await expect(
      repository.recordEvent({
        deviceInfo: "React Native",
        eventType: "asset_created",
        metadata: {
          fields: { accountNumber: "123456789" },
          notes: "Private note",
          title: "Main bank account",
        },
      }),
    ).rejects.toThrow("Audit metadata contains plaintext vault payload fields.");
    expect(table.calls).toHaveLength(0);
  });
});

type AuditTableCall = {
  method: string;
  table: string;
  values: unknown;
};

function createAuditTableDouble(): {
  calls: AuditTableCall[];
  from: SupabaseAuditClient["from"];
} {
  const calls: AuditTableCall[] = [];

  return {
    calls,
    from(table: "audit_events") {
      return {
        insert(values: unknown) {
          calls.push({ method: "insert", table, values });

          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
}
