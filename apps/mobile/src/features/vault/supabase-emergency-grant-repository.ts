import { fromBase64, toBase64 } from "@/shared/crypto/vault-crypto";

import type { EmergencyWrappedMEKPackage } from "./emergency-key-wrapping";

const EMERGENCY_GRANT_COLUMNS =
  "id, grant_type, status, wrapped_mek_ciphertext, wrapped_mek_nonce, wrapping_algorithm, kdf_algorithm, kdf_salt, kdf_params, created_at, updated_at, released_at, revoked_at";

type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

export type SupabaseEmergencyKeyGrantRow = {
  created_at?: string;
  grant_type: "pre_authorized_kin" | "sealed_emergency_code";
  id?: string;
  kdf_algorithm: "argon2id" | null;
  kdf_params: EmergencyWrappedMEKPackage["kdf"] extends infer Kdf
    ? Kdf extends { params: infer Params }
      ? Params
      : null
    : null;
  kdf_salt: string | null;
  released_at?: string | null;
  revoked_at?: string | null;
  status: "active" | "revoked" | "released";
  updated_at?: string;
  wrapped_mek_ciphertext: string;
  wrapped_mek_nonce: string;
  wrapping_algorithm: "xchacha20poly1305_ietf";
};

type EmergencyGrantTable = {
  insert: (values: SupabaseEmergencyKeyGrantRow) => {
    select: (columns: typeof EMERGENCY_GRANT_COLUMNS) => {
      single: () => Promise<SupabaseResult<SupabaseEmergencyKeyGrantRow>>;
    };
  };
  select: (columns: typeof EMERGENCY_GRANT_COLUMNS) => {
    eq: (column: "grant_type" | "status", value: string) => {
      eq: (column: "grant_type" | "status", value: string) => {
        maybeSingle: () => Promise<SupabaseResult<SupabaseEmergencyKeyGrantRow | null>>;
      };
      maybeSingle: () => Promise<SupabaseResult<SupabaseEmergencyKeyGrantRow | null>>;
    };
    maybeSingle: () => Promise<SupabaseResult<SupabaseEmergencyKeyGrantRow | null>>;
  };
  update: (values: {
    revoked_at: string;
    status: "revoked";
    updated_at: string;
  }) => {
    eq: (column: "grant_type" | "status", value: string) => {
      eq: (column: "grant_type" | "status", value: string) => unknown;
    };
  };
};

export type SupabaseEmergencyGrantClient = {
  from: (table: "emergency_key_grants") => EmergencyGrantTable;
};

export function createSupabaseEmergencyGrantRepository({
  from,
  now = () => new Date(),
}: SupabaseEmergencyGrantClient & { now?: () => Date }) {
  const table = from("emergency_key_grants");

  return {
    async loadActiveSealedCodeGrant(): Promise<EmergencyWrappedMEKPackage | null> {
      const result = await table
        .select(EMERGENCY_GRANT_COLUMNS)
        .eq("grant_type", "sealed_emergency_code")
        .eq("status", "active")
        .maybeSingle();

      assertSupabaseSuccess(result, "Emergency access grant could not be loaded.");

      return result.data ? deserializeEmergencyGrantRow(result.data) : null;
    },

    async revokeActiveSealedCodeGrants(): Promise<void> {
      const timestamp = now().toISOString();

      await table
        .update({
          revoked_at: timestamp,
          status: "revoked",
          updated_at: timestamp,
        })
        .eq("grant_type", "sealed_emergency_code")
        .eq("status", "active");
    },

    async saveSealedCodeGrant(
      sealedPackage: EmergencyWrappedMEKPackage,
    ): Promise<EmergencyWrappedMEKPackage> {
      if (sealedPackage.grantType !== "sealed_emergency_code" || !sealedPackage.kdf) {
        throw new Error("Emergency access grant is not a sealed code package.");
      }

      const result = await table
        .insert(await serializeEmergencyWrappedMEKPackage(sealedPackage))
        .select(EMERGENCY_GRANT_COLUMNS)
        .single();

      assertSupabaseSuccess(result, "Emergency access grant could not be saved.");

      return deserializeEmergencyGrantRow(result.data);
    },
  };
}

export async function serializeEmergencyWrappedMEKPackage(
  sealedPackage: EmergencyWrappedMEKPackage,
): Promise<SupabaseEmergencyKeyGrantRow> {
  return {
    grant_type: sealedPackage.grantType,
    kdf_algorithm: sealedPackage.kdf?.algorithm ?? null,
    kdf_params: sealedPackage.kdf?.params ?? null,
    kdf_salt: sealedPackage.kdf ? await toBase64(sealedPackage.kdf.salt) : null,
    status: "active",
    wrapped_mek_ciphertext: await toBase64(sealedPackage.ciphertext),
    wrapped_mek_nonce: await toBase64(sealedPackage.nonce),
    wrapping_algorithm: sealedPackage.wrappingAlgorithm,
  };
}

export async function deserializeEmergencyGrantRow(
  row: SupabaseEmergencyKeyGrantRow,
): Promise<EmergencyWrappedMEKPackage> {
  return {
    ciphertext: await fromBase64(row.wrapped_mek_ciphertext),
    grantType: row.grant_type,
    kdf:
      row.kdf_algorithm === "argon2id" && row.kdf_salt && row.kdf_params
        ? {
            algorithm: "argon2id",
            params: row.kdf_params,
            salt: await fromBase64(row.kdf_salt),
          }
        : null,
    nonce: await fromBase64(row.wrapped_mek_nonce),
    wrappingAlgorithm: row.wrapping_algorithm,
  };
}

function assertSupabaseSuccess<T>(
  result: SupabaseResult<T>,
  fallbackMessage: string,
): asserts result is SupabaseResult<NonNullable<T>> {
  if (result.error) {
    throw new Error(result.error.message ?? fallbackMessage);
  }
}
