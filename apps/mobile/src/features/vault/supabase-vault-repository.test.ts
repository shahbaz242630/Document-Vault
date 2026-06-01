import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import { createVaultStore } from "./vault-store";
import {
  createSupabaseVaultRepository,
  type SupabaseVaultClient,
} from "./supabase-vault-repository";
import type { SupabaseVaultAssetRow } from "./supabase-vault-codec";

describe("supabase vault repository", () => {
  it("saves encrypted asset records without plaintext fields", async () => {
    const table = createAssetTableDouble();
    const repository = createSupabaseVaultRepository({ from: table.from });
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({
      generateId: () => "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      now: () => new Date("2026-05-30T10:00:00.000Z"),
    });
    const record = await store.addAsset({
      key,
      payload: {
        assetType: "bank_account",
        fields: {
          institutionName: "Example Bank",
          lastFourDigits: "1234",
        },
        notes: "Private family note",
        title: "Primary account",
      },
    });

    const saved = await repository.saveAsset(record);

    expect(saved.id).toBe(record.id);
    expect(table.calls[0]).toMatchObject({
      method: "upsert",
      options: { onConflict: "id" },
      table: "vault_assets",
    });
    expect(table.calls[0]?.values).toMatchObject({
      asset_type: "bank_account",
      created_at: "2026-05-30T10:00:00.000Z",
      deleted_at: null,
      id: record.id,
      updated_at: "2026-05-30T10:00:00.000Z",
    });
    expect(JSON.stringify(table.calls[0]?.values)).not.toContain("Primary account");
    expect(JSON.stringify(table.calls[0]?.values)).not.toContain("Example Bank");
    expect(JSON.stringify(table.calls[0]?.values)).not.toContain("Private family note");
  });

  it("lists encrypted asset records ordered by creation time", async () => {
    const table = createAssetTableDouble();
    const repository = createSupabaseVaultRepository({ from: table.from });
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({
      generateId: () => "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      now: () => new Date("2026-05-30T10:00:00.000Z"),
    });
    await repository.saveAsset(
      await store.addAsset({
        key,
        payload: {
          assetType: "contact",
          fields: {
            country: "UAE",
            name: "Lawyer",
          },
          title: "Legal contact",
        },
      }),
    );

    const records = await repository.listAssets();

    expect(records).toHaveLength(1);
    expect(records[0]?.assetType).toBe("contact");
    expect(table.calls.at(-1)).toEqual({
      columns:
        "id, asset_type, ciphertext, nonce, created_at, updated_at, deleted_at",
      method: "select",
      order: { ascending: true, column: "created_at" },
      table: "vault_assets",
    });
  });

  it("updates deletion metadata for soft delete and restore", async () => {
    const table = createAssetTableDouble();
    const repository = createSupabaseVaultRepository({ from: table.from });
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({
      generateId: () => "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      now: () => new Date("2026-05-30T10:00:00.000Z"),
    });
    await repository.saveAsset(
      await store.addAsset({
        key,
        payload: {
          assetType: "other",
          fields: {},
          title: "Important note",
        },
      }),
    );

    const deleted = await repository.softDeleteAsset({
      deletedAt: "2026-05-30T11:00:00.000Z",
      id: "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      updatedAt: "2026-05-30T11:00:00.000Z",
    });
    const restored = await repository.restoreAsset({
      id: "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
      updatedAt: "2026-05-30T12:00:00.000Z",
    });

    expect(deleted?.deletedAt).toBe("2026-05-30T11:00:00.000Z");
    expect(restored?.deletedAt).toBeNull();
    expect(table.calls).toContainEqual({
      filters: [{ column: "id", value: "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f" }],
      method: "update",
      table: "vault_assets",
      values: {
        deleted_at: "2026-05-30T11:00:00.000Z",
        updated_at: "2026-05-30T11:00:00.000Z",
      },
    });
    expect(table.calls).toContainEqual({
      filters: [{ column: "id", value: "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f" }],
      method: "update",
      table: "vault_assets",
      values: {
        deleted_at: null,
        updated_at: "2026-05-30T12:00:00.000Z",
      },
    });
  });

  it("permanently deletes an encrypted asset row", async () => {
    const table = createAssetTableDouble();
    const repository = createSupabaseVaultRepository({ from: table.from });
    const key = await generateMasterEncryptionKey();
    const store = createVaultStore({
      generateId: () => "8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f",
    });
    await repository.saveAsset(
      await store.addAsset({
        key,
        payload: {
          assetType: "other",
          fields: {},
          title: "Important note",
        },
      }),
    );

    await expect(
      repository.permanentlyDeleteAsset("8b1faea6-b3df-486b-9fe3-6f8a1c9d4b5f"),
    ).resolves.toBe(true);
    await expect(
      repository.permanentlyDeleteAsset("missing"),
    ).resolves.toBe(false);
  });
});

type AssetTableCall = {
  columns?: string;
  filters?: Array<{ column: string; value: string }>;
  method: string;
  options?: unknown;
  order?: { ascending: boolean; column: string };
  table: string;
  values?: unknown;
};

function createAssetTableDouble(): {
  calls: AssetTableCall[];
  from: SupabaseVaultClient["from"];
} {
  const rows = new Map<string, Record<string, unknown>>();
  const calls: AssetTableCall[] = [];

  return {
    calls,
    from(table: string) {
      return {
        delete() {
          return createDeleteBuilder({
            calls,
            rows,
            table,
          });
        },
        select(columns: string) {
          calls.push({ columns, method: "select", table });
          return {
            order(column: string, order: { ascending: boolean }) {
              calls[calls.length - 1] = {
                ...calls[calls.length - 1],
                order: { ascending: order.ascending, column },
              };

              return Promise.resolve({
                data: Array.from(rows.values()).map(toAssetRow),
                error: null,
              });
            },
          };
        },
        update(values: Record<string, unknown>) {
          return createUpdateBuilder({
            calls,
            rows,
            table,
            values,
          });
        },
        upsert(values: Record<string, unknown>, options: unknown) {
          calls.push({ method: "upsert", options, table, values });
          rows.set(String(values.id), { ...values });

          return createSingleResultBuilder(rows.get(String(values.id)));
        },
      };
    },
  };
}

function createDeleteBuilder({
  calls,
  rows,
  table,
}: {
  calls: AssetTableCall[];
  rows: Map<string, Record<string, unknown>>;
  table: string;
}) {
  const filters: Array<{ column: string; value: string }> = [];

  return {
    eq(column: string, value: string) {
      filters.push({ column, value });
      const row = rows.get(value);

      if (row) {
        rows.delete(value);
      }

      calls.push({ filters, method: "delete", table });

      return createMaybeSingleResultBuilder(row ? { id: String(row.id) } : null);
    },
  };
}

function createUpdateBuilder({
  calls,
  rows,
  table,
  values,
}: {
  calls: AssetTableCall[];
  rows: Map<string, Record<string, unknown>>;
  table: string;
  values: Record<string, unknown>;
}) {
  const filters: Array<{ column: string; value: string }> = [];

  return {
    eq(column: string, value: string) {
      filters.push({ column, value });
      const row = rows.get(value);
      const updatedRow = row ? { ...row, ...values } : null;

      if (updatedRow) {
        rows.set(value, updatedRow);
      }

      calls.push({ filters, method: "update", table, values });

      return createMaybeSingleResultBuilder(
        updatedRow ? toAssetRow(updatedRow) : null,
      );
    },
  };
}

function createSingleResultBuilder(row: Record<string, unknown> | undefined) {
  return {
    select() {
      return {
        single() {
          return Promise.resolve({ data: toAssetRow(row), error: null });
        },
      };
    },
  };
}

function createMaybeSingleResultBuilder<T>(row: T | null) {
  return {
    select() {
      return {
        maybeSingle() {
          return Promise.resolve({ data: row, error: null });
        },
      };
    },
  };
}

function toAssetRow(row: Record<string, unknown> | undefined): SupabaseVaultAssetRow {
  return {
    asset_type: row?.asset_type as SupabaseVaultAssetRow["asset_type"],
    ciphertext: String(row?.ciphertext),
    created_at: String(row?.created_at),
    deleted_at: typeof row?.deleted_at === "string" ? row.deleted_at : null,
    id: String(row?.id),
    nonce: String(row?.nonce),
    updated_at: String(row?.updated_at),
  };
}
