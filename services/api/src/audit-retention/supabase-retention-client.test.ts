import { describe, expect, it } from "vitest";

import { createSupabaseAuditRetentionProcessorClient } from "./supabase-retention-client";

describe("supabase audit retention processor client", () => {
  it("deletes only anonymized audit rows older than the retention cutoff", async () => {
    const supabase = createSupabaseDouble(4);
    const client = createSupabaseAuditRetentionProcessorClient(supabase);

    const deleted = await client.deleteAnonymizedBefore("2026-06-02T12:00:00.000Z");

    expect(deleted).toBe(4);
    expect(supabase.calls).toEqual([
      { method: "delete", table: "audit_events" },
      { column: "user_id", method: "is", table: "audit_events", value: null },
      {
        column: "occurred_at",
        method: "lt",
        table: "audit_events",
        value: "2026-06-02T12:00:00.000Z",
      },
      { method: "select", table: "audit_events", options: { count: "exact", head: true } },
    ]);
  });
});

type SupabaseCall =
  | { method: "delete"; table: string }
  | { column: string; method: "is"; table: string; value: unknown }
  | { column: string; method: "lt"; table: string; value: unknown }
  | { method: "select"; options: { count: "exact"; head: true }; table: string };

function createSupabaseDouble(count: number) {
  const calls: SupabaseCall[] = [];

  return {
    calls,
    from(table: "audit_events") {
      const builder = {
        delete() {
          calls.push({ method: "delete", table });

          return builder;
        },
        is(column: string, value: unknown) {
          calls.push({ column, method: "is", table, value });

          return builder;
        },
        lt(column: string, value: unknown) {
          calls.push({ column, method: "lt", table, value });

          return builder;
        },
        select(_columns: string, options: { count: "exact"; head: true }) {
          calls.push({ method: "select", options, table });

          return Promise.resolve({ count, data: null, error: null });
        },
      };

      return builder;
    },
  };
}
