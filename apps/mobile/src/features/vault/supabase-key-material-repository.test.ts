import { describe, expect, it } from "vitest";

import { generateSalt } from "@/shared/crypto/kek-derivation";
import { wrapMEK } from "@/shared/crypto/mek-wrapping";
import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "./supabase-key-material-repository";
import type { SupabaseVaultKeyMaterialRow, VaultKeyMaterial } from "./supabase-vault-codec";

describe("supabase key material repository", () => {
  it("saves wrapped MEK key material without plaintext MEK or password fields", async () => {
    const table = createKeyMaterialTableDouble();
    const repository = createSupabaseKeyMaterialRepository({ from: table.from });
    const keyMaterial = await createKeyMaterial();

    await repository.saveKeyMaterial(keyMaterial);

    expect(table.calls[0]).toMatchObject({
      method: "upsert",
      options: { onConflict: "user_id" },
      table: "vault_key_material",
    });
    expect(table.calls[0]?.values).toMatchObject({
      kdf_algorithm: "argon2id",
      recovery_version: 1,
    });
    expect(Object.keys(table.calls[0]?.values ?? {})).not.toContain("mek");
    expect(Object.keys(table.calls[0]?.values ?? {})).not.toContain("password");
    expect(Object.keys(table.calls[0]?.values ?? {})).not.toContain("user_id");
  });

  it("loads wrapped MEK key material", async () => {
    const table = createKeyMaterialTableDouble();
    const repository = createSupabaseKeyMaterialRepository({ from: table.from });
    const keyMaterial = await createKeyMaterial();
    await repository.saveKeyMaterial(keyMaterial);

    const loaded = await repository.loadKeyMaterial();

    expect(loaded).toEqual(keyMaterial);
    expect(table.calls.at(-1)).toEqual({
      columns:
        "wrapped_mek_ciphertext, wrapped_mek_nonce, kek_salt, kdf_algorithm, kdf_params, recovery_version",
      method: "select",
      table: "vault_key_material",
    });
  });

  it("returns null when no key material exists", async () => {
    const table = createKeyMaterialTableDouble();
    const repository = createSupabaseKeyMaterialRepository({ from: table.from });

    await expect(repository.loadKeyMaterial()).resolves.toBeNull();
  });
});

type KeyMaterialTableCall = {
  columns?: string;
  method: string;
  options?: unknown;
  table: string;
  values?: Record<string, unknown>;
};

async function createKeyMaterial(): Promise<VaultKeyMaterial> {
  const mek = await generateMasterEncryptionKey();
  const kek = await generateMasterEncryptionKey();

  return {
    kdfAlgorithm: "argon2id",
    kdfParams: {
      keyLength: 32,
      memlimit: 268435456,
      opslimit: 3,
    },
    kekSalt: await generateSalt(),
    recoveryVersion: 1,
    wrappedMek: await wrapMEK(mek, kek),
  };
}

function createKeyMaterialTableDouble(): {
  calls: KeyMaterialTableCall[];
  from: SupabaseKeyMaterialClient["from"];
} {
  const calls: KeyMaterialTableCall[] = [];
  let row: SupabaseVaultKeyMaterialRow | null = null;

  return {
    calls,
    from(table: "vault_key_material") {
      return {
        select(columns: string) {
          calls.push({ columns, method: "select", table });

          return {
            maybeSingle() {
              return Promise.resolve({ data: row, error: null });
            },
          };
        },
        upsert(values: SupabaseVaultKeyMaterialRow, options: unknown) {
          calls.push({ method: "upsert", options, table, values });
          row = { ...values };
          const savedRow = row;

          return {
            select() {
              return {
                single() {
                  return Promise.resolve({ data: savedRow, error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}
