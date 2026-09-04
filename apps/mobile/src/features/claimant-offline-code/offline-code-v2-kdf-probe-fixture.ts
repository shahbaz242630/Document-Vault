import type {
  OfflineCodeClientSecretV2,
  OfflineCodeKdfProfileV2,
  OfflineCodePublicLocatorV2,
  OfflineCodeRecordBindingV2,
} from "@vault/shared-types";

export const OFFLINE_CODE_V2_KDF_PROBE_FIXTURE = {
  publicLocator: {
    protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "public_locator",
    encoding: "crockford_base32_checksum",
    locator: "SK2-L-M6HA-7955-MTKT-HADA-NEPA-VBNF-P0-F",
  },
  clientSecret: {
    protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "client_held_secret",
    encoding: "crockford_base32_checksum",
    secret: "SK2-S-P6SB-7D5N-PTVV-HEDT-QEYB-VFNZ-R30W-5GY4-RQ3C-FJ0-=",
  },
  kdfProfile: {
    protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "client_secret_root",
    algorithm: "argon2id",
    profile_id: "argon2id-synthetic-test-v2",
    production_approved: false,
    opslimit: 2,
    memlimit_bytes: 67_108_864,
    output_bytes: 32,
    salt: "ycrLzM3Oz9DR0tPU1dbX2A",
  },
  recordBinding: {
    protocol: "sanduqkin:claim:offline-code:v2",
    purpose: "record_binding",
    locator_record_id: "50000000-0000-4000-8000-000000000005",
    locator_version: 2,
    locator_commitment: "XTSL8NBxarBjlNqVGOOeh15vQE0rPeAP-tbvnzowt6M",
    grant_id: "40000000-0000-4000-8000-000000000004",
    owner_id: "10000000-0000-4000-8000-000000000001",
    kdf_profile_id: "argon2id-synthetic-test-v2",
    proof_key_version: 1,
    proof_public_key: "nBY_TLLD299Ro7qJQlpgBZFqqHoqmnlfU9f6wSEOW-M",
  },
} as const satisfies Readonly<{
  publicLocator: OfflineCodePublicLocatorV2;
  clientSecret: OfflineCodeClientSecretV2;
  kdfProfile: OfflineCodeKdfProfileV2;
  recordBinding: OfflineCodeRecordBindingV2;
}>;
