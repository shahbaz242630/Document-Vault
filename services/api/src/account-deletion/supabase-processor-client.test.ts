import { describe, expect, it } from "vitest";

import { createSupabaseAccountDeletionProcessorClient } from "./supabase-processor-client";

type SupabaseAdminClientLike = Parameters<typeof createSupabaseAccountDeletionProcessorClient>[0];

describe("supabase account deletion processor client", () => {
  it("deletes encrypted vault rows and wrapped key material for a deleted account", async () => {
    const supabase = createSupabaseAdminClientDouble();
    const client = createSupabaseAccountDeletionProcessorClient(supabase);

    await client.deleteVaultData("user-1");

    expect(supabase.calls).toEqual([
      { method: "delete", table: "vault_assets" },
      { column: "user_id", method: "eq", table: "vault_assets", value: "user-1" },
      { method: "delete", table: "vault_key_material" },
      { column: "user_id", method: "eq", table: "vault_key_material", value: "user-1" },
    ]);
  });

  it("anonymizes audit rows without deleting retained audit history", async () => {
    const supabase = createSupabaseAdminClientDouble();
    const client = createSupabaseAccountDeletionProcessorClient(supabase);

    await client.anonymizeAuditEvents("user-1");

    expect(supabase.calls).toEqual([
      {
        method: "update",
        table: "audit_events",
        values: {
          user_id: null,
        },
      },
      { column: "user_id", method: "eq", table: "audit_events", value: "user-1" },
    ]);
  });
});

type SupabaseCall =
  | { method: "delete"; table: string }
  | { method: "update"; table: string; values: Record<string, unknown> }
  | { column: string; method: "eq"; table: string; value: unknown };

function createSupabaseAdminClientDouble() {
  const calls: SupabaseCall[] = [];

  return {
    calls,
    auth: {
      admin: {
        async deleteUser() {
          return { data: null, error: null };
        },
      },
    },
    from(table: string) {
      const builder = {
        delete() {
          calls.push({ method: "delete", table });

          return builder;
        },
        eq(column: string, value: unknown) {
          calls.push({ column, method: "eq", table, value });

          return Promise.resolve({ data: null, error: null });
        },
        update(values: Record<string, unknown>) {
          calls.push({ method: "update", table, values });

          return builder;
        },
      };

      return builder;
    },
  } as unknown as SupabaseAdminClientLike & { calls: SupabaseCall[] };
}
