export const OFFLINE_CODE_PROTOCOL_V2 = "sanduqkin:claim:offline-code:v2" as const;

export const OFFLINE_CODE_V2_PROTOCOL_APPROVED = false as const;
export const OFFLINE_CODE_V2_AUTHORITY = "route_possession_only" as const;
export const OFFLINE_CODE_V2_CHALLENGE_TTL_SECONDS = 300 as const;
export const OFFLINE_CODE_V2_LOCATOR_BYTES = 16 as const;
export const OFFLINE_CODE_V2_SECRET_BYTES = 24 as const;
export const OFFLINE_CODE_V2_SYNTHETIC_KDF_PROFILE_ID = "argon2id-synthetic-test-v2" as const;
export const OFFLINE_CODE_V2_SYNTHETIC_KDF_OPSLIMIT = 2 as const;
export const OFFLINE_CODE_V2_SYNTHETIC_KDF_MEMLIMIT_BYTES = 67_108_864 as const;

export const OFFLINE_CODE_V2_LABELS = {
  locatorCommitment: "sanduqkin:claim:offline-code:v2:public-locator-commitment",
  locatorIndex: "sanduqkin:claim:offline-code:v2:server-locator-index",
  recordBinding: "sanduqkin:claim:offline-code:v2:record-binding",
  rootInput: "sanduqkin:claim:offline-code:v2:client-secret-root",
  proofSeed: "sanduqkin:claim:offline-code:v2:possession-proof-seed",
  possessionProof: "sanduqkin:claim:offline-code:v2:possession-proof",
  wrapKey: "sanduqkin:claim:offline-code:v2:release-wrap-key",
  wrapAssociatedData: "sanduqkin:claim:offline-code:v2:release-wrap-associated-data",
} as const;
