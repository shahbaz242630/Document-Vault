import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { createWebVaultRepository } from "./repository";

describe("web vault repository", () => {
  it("maps existing mobile key material and category-scoped ciphertext rows", async () => {
    const calls: unknown[] = [];
    const client = createClientDouble(calls);
    const repository = createWebVaultRepository(client);

    await expect(repository.loadKeyMaterial()).resolves.toMatchObject({
      kdfAlgorithm: "argon2id",
      kekSalt: "salt",
      wrappedMekCiphertext: "wrapped",
    });
    await expect(repository.listAssets("bank_account")).resolves.toEqual([{
      assetType: "bank_account",
      ciphertext: "ciphertext",
      createdAt: "2026-07-19T00:00:00.000Z",
      deletedAt: null,
      id: "00000000-0000-4000-8000-000000000001",
      nonce: "nonce",
      updatedAt: "2026-07-19T00:00:00.000Z",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "bank_account"]);
    await expect(repository.listAssets("card")).resolves.toMatchObject([{
      assetType: "card",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "card"]);
    await expect(repository.listAssets("investment")).resolves.toMatchObject([{
      assetType: "investment",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "investment"]);
    await expect(repository.listAssets("property")).resolves.toMatchObject([{
      assetType: "property",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "property"]);
    await expect(repository.listAssets("insurance")).resolves.toMatchObject([{
      assetType: "insurance",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "insurance"]);
    await expect(repository.listAssets("crypto")).resolves.toMatchObject([{
      assetType: "crypto",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "crypto"]);
    await expect(repository.listAssets("pension")).resolves.toMatchObject([{
      assetType: "pension",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "pension"]);
    await expect(repository.listAssets("subscription")).resolves.toMatchObject([{
      assetType: "subscription",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "subscription"]);
    await expect(repository.listAssets("document_location")).resolves.toMatchObject([{
      assetType: "document_location",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "document_location"]);
    await expect(repository.listAssets("contact")).resolves.toMatchObject([{
      assetType: "contact",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "contact"]);
    await expect(repository.listAssets("vehicle")).resolves.toMatchObject([{
      assetType: "vehicle",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "vehicle"]);
    await expect(repository.listAssets("loan_debt")).resolves.toMatchObject([{
      assetType: "loan_debt",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "loan_debt"]);
    await expect(repository.listAssets("medical_care")).resolves.toMatchObject([{
      assetType: "medical_care",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "medical_care"]);
    await expect(repository.listAssets("dependent_pet")).resolves.toMatchObject([{
      assetType: "dependent_pet",
    }]);
    expect(calls).toContainEqual(["eq", "asset_type", "dependent_pet"]);
  });

  it("persists ciphertext and safe metadata without plaintext fields", async () => {
    const calls: unknown[] = [];
    const repository = createWebVaultRepository(createClientDouble(calls));
    await repository.save({
      assetType: "bank_account",
      ciphertext: "encrypted-value",
      createdAt: "2026-07-19T00:00:00.000Z",
      deletedAt: null,
      id: "00000000-0000-4000-8000-000000000002",
      nonce: "random-nonce",
      updatedAt: "2026-07-19T00:00:00.000Z",
    });
    const serializedCalls = JSON.stringify(calls);
    expect(serializedCalls).toContain("encrypted-value");
    expect(serializedCalls).not.toContain("institutionName");
    expect(serializedCalls).not.toContain("lastFourDigits");
  });
});

function createClientDouble(calls: unknown[]): SupabaseClient {
  return {
    from(table: string) {
      calls.push(["from", table]);
      return {
        delete() {
          return { async eq(column: string, value: string) { calls.push(["delete", column, value]); return { error: null }; } };
        },
        select(columns: string) {
          calls.push(["select", columns]);
          if (table === "vault_key_material") return {
            async maybeSingle() {
              return { data: {
                kdf_algorithm: "argon2id",
                kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
                kek_salt: "salt",
                wrapped_mek_ciphertext: "wrapped",
                wrapped_mek_nonce: "nonce",
              }, error: null };
            },
          };
          return {
            eq(column: string, value: string) {
              calls.push(["eq", column, value]);
              return { async order() { return { data: [{
                asset_type: value,
                ciphertext: "ciphertext",
                created_at: "2026-07-19T00:00:00.000Z",
                deleted_at: null,
                id: "00000000-0000-4000-8000-000000000001",
                nonce: "nonce",
                updated_at: "2026-07-19T00:00:00.000Z",
              }], error: null }; } };
            },
          };
        },
        async upsert(values: unknown, options: unknown) {
          calls.push(["upsert", values, options]);
          return { error: null };
        },
        update(values: unknown) {
          return { async eq(column: string, value: string) { calls.push(["update", values, column, value]); return { error: null }; } };
        },
      };
    },
  } as unknown as SupabaseClient;
}
