import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import { wrapMEKWithEmergencyCode } from "./emergency-key-wrapping";
import {
  createSupabaseEmergencyGrantRepository,
  type SupabaseEmergencyGrantClient,
  type SupabaseEmergencyKeyGrantRow,
} from "./supabase-emergency-grant-repository";

describe("supabase emergency grant repository", () => {
  it("saves sealed emergency code grants without raw code or plaintext MEK", async () => {
    const table = createEmergencyGrantTableDouble();
    const repository = createSupabaseEmergencyGrantRepository({ from: table.from });
    const mek = await generateMasterEncryptionKey();
    const wrapped = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek,
    });

    await repository.saveSealedCodeGrant(wrapped.sealedPackage);

    expect(table.calls[0]).toMatchObject({
      method: "insert",
      table: "emergency_key_grants",
    });
    expect(table.calls[0]?.values).toMatchObject({
      grant_type: "sealed_emergency_code",
      kdf_algorithm: "argon2id",
      status: "active",
      wrapping_algorithm: "xchacha20poly1305_ietf",
    });
    expect(JSON.stringify(table.calls[0]?.values)).not.toContain("K7Q9");
    expect(JSON.stringify(table.calls[0]?.values)).not.toContain("M2XD");
    expect(Object.keys(table.calls[0]?.values ?? {})).not.toContain("mek");
    expect(Object.keys(table.calls[0]?.values ?? {})).not.toContain("emergency_code");
  });

  it("loads the active sealed emergency code grant", async () => {
    const table = createEmergencyGrantTableDouble();
    const repository = createSupabaseEmergencyGrantRepository({ from: table.from });
    const wrapped = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek: await generateMasterEncryptionKey(),
    });
    await repository.saveSealedCodeGrant(wrapped.sealedPackage);

    const loaded = await repository.loadActiveSealedCodeGrant();

    expect(loaded?.grantType).toBe("sealed_emergency_code");
    expect(loaded?.kdf?.algorithm).toBe("argon2id");
    expect(table.calls.at(-1)).toMatchObject({
      filters: [
        { column: "grant_type", value: "sealed_emergency_code" },
        { column: "status", value: "active" },
      ],
      method: "select",
      table: "emergency_key_grants",
    });
  });

  it("revokes active sealed emergency code grants", async () => {
    const table = createEmergencyGrantTableDouble();
    const repository = createSupabaseEmergencyGrantRepository({
      from: table.from,
      now: () => new Date("2026-06-08T12:00:00.000Z"),
    });
    const wrapped = await wrapMEKWithEmergencyCode({
      emergencyCode: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek: await generateMasterEncryptionKey(),
    });
    await repository.saveSealedCodeGrant(wrapped.sealedPackage);

    await repository.revokeActiveSealedCodeGrants();

    expect(table.calls.at(-1)).toEqual({
      filters: [
        { column: "grant_type", value: "sealed_emergency_code" },
        { column: "status", value: "active" },
      ],
      method: "update",
      table: "emergency_key_grants",
      values: {
        revoked_at: "2026-06-08T12:00:00.000Z",
        status: "revoked",
        updated_at: "2026-06-08T12:00:00.000Z",
      },
    });
    await expect(repository.loadActiveSealedCodeGrant()).resolves.toBeNull();
  });
});

type EmergencyGrantTableCall = {
  columns?: string;
  filters?: Array<{ column: string; value: string }>;
  method: string;
  table: string;
  values?: Record<string, unknown>;
};

function createEmergencyGrantTableDouble(): {
  calls: EmergencyGrantTableCall[];
  from: SupabaseEmergencyGrantClient["from"];
} {
  const calls: EmergencyGrantTableCall[] = [];
  const rows: SupabaseEmergencyKeyGrantRow[] = [];

  return {
    calls,
    from(table: "emergency_key_grants") {
      return {
        insert(values: SupabaseEmergencyKeyGrantRow) {
          calls.push({ method: "insert", table, values });
          rows.push({ ...values });

          return createSingleResultBuilder(values);
        },
        select(columns: string) {
          const filters: Array<{ column: string; value: string }> = [];
          calls.push({ columns, filters, method: "select", table });

          return createFilterableMaybeSingleBuilder({ filters, rows });
        },
        update(values: Record<string, unknown>) {
          const filters: Array<{ column: string; value: string }> = [];

          return {
            eq(column: string, value: string) {
              filters.push({ column, value });

              if (filters.length === 2) {
                for (const row of rows) {
                  if (row.grant_type === "sealed_emergency_code" && row.status === "active") {
                    Object.assign(row, values);
                  }
                }
                calls.push({ filters, method: "update", table, values });
              }

              return this;
            },
          };
        },
      };
    },
  };
}

function createSingleResultBuilder(row: SupabaseEmergencyKeyGrantRow) {
  return {
    select() {
      return {
        single() {
          return Promise.resolve({ data: row, error: null });
        },
      };
    },
  };
}

function createFilterableMaybeSingleBuilder({
  filters,
  rows,
}: {
  filters: Array<{ column: string; value: string }>;
  rows: SupabaseEmergencyKeyGrantRow[];
}) {
  return {
    eq(column: string, value: string) {
      filters.push({ column, value });

      return this;
    },
    maybeSingle() {
      const row =
        rows.find(
          (candidate) =>
            candidate.grant_type === "sealed_emergency_code" &&
            candidate.status === "active",
        ) ?? null;

      return Promise.resolve({ data: row, error: null });
    },
  };
}
