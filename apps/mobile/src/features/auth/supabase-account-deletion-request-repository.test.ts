import { describe, expect, it } from "vitest";

import {
  createSupabaseAccountDeletionRequestRepository,
  type SupabaseAccountDeletionRequestClient,
} from "./supabase-account-deletion-request-repository";

describe("supabase account deletion request repository", () => {
  it("inserts a pending deletion request and lets the database assign owner and dates", async () => {
    const table = createAccountDeletionRequestTableDouble();
    const repository = createSupabaseAccountDeletionRequestRepository({ from: table.from });

    await repository.requestDeletion();

    expect(table.calls).toEqual([
      {
        method: "insert",
        table: "account_deletion_requests",
        values: {
          status: "pending",
        },
      },
    ]);
  });

  it("surfaces insert failures", async () => {
    const table = createAccountDeletionRequestTableDouble({
      error: { message: "RLS rejected request" },
    });
    const repository = createSupabaseAccountDeletionRequestRepository({ from: table.from });

    await expect(repository.requestDeletion()).rejects.toThrow("RLS rejected request");
  });
});

type AccountDeletionRequestTableCall = {
  method: string;
  table: string;
  values: unknown;
};

function createAccountDeletionRequestTableDouble(options?: {
  error?: { message?: string };
}): {
  calls: AccountDeletionRequestTableCall[];
  from: SupabaseAccountDeletionRequestClient["from"];
} {
  const calls: AccountDeletionRequestTableCall[] = [];

  return {
    calls,
    from(table: "account_deletion_requests") {
      return {
        insert(values: unknown) {
          calls.push({ method: "insert", table, values });

          return Promise.resolve({ data: null, error: options?.error ?? null });
        },
      };
    },
  };
}
