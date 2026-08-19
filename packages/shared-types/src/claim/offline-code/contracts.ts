export type OfflineCodePublicLocatorV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "public_locator";
  encoding: "crockford_base32_checksum";
  locator: string;
}>;

export type OfflineCodeClientSecretV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "client_held_secret";
  encoding: "crockford_base32_checksum";
  secret: string;
}>;

export type OfflineCodeKdfProfileV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "client_secret_root";
  algorithm: "argon2id";
  profile_id: string;
  production_approved: false;
  opslimit: number;
  memlimit_bytes: number;
  output_bytes: 32;
  salt: string;
}>;

export type OfflineCodeRecordBindingV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "record_binding";
  locator_record_id: string;
  locator_version: number;
  locator_commitment: string;
  grant_id: string;
  owner_id: string;
  kdf_profile_id: string;
  proof_key_version: number;
  proof_public_key: string;
}>;

export type OfflineCodeChallengeV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "possession_challenge";
  authority: "route_possession_only";
  challenge_id: string;
  locator_record_id: string;
  locator_version: number;
  locator_commitment: string;
  proof_key_version: number;
  proof_public_key: string;
  record_binding_digest: string;
  nonce: string;
  origin: string;
  issued_at: string;
  expires_at: string;
}>;

export type OfflineCodePossessionProofV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "possession_proof";
  authority: "route_possession_only";
  challenge_id: string;
  locator_record_id: string;
  locator_version: number;
  proof_key_version: number;
  proof_public_key: string;
  record_binding_digest: string;
  signature: string;
}>;

export type OfflineCodeWrappedMekV2 = Readonly<{
  protocol: "sanduqkin:claim:offline-code:v2";
  purpose: "release_material_wrap";
  profile: "offline_code_v2";
  algorithm: "xchacha20poly1305_ietf";
  locator_record_id: string;
  locator_version: number;
  locator_commitment: string;
  grant_id: string;
  owner_id: string;
  created_at: string;
  kdf_profile_id: string;
  proof_key_version: number;
  record_binding_digest: string;
  nonce: string;
  ciphertext: string;
}>;

export type OfflineCodeProtocolBundleV2 = Readonly<{
  public_locator: OfflineCodePublicLocatorV2;
  kdf_profile: OfflineCodeKdfProfileV2;
  record_binding: OfflineCodeRecordBindingV2;
  challenge: OfflineCodeChallengeV2;
  possession_proof: OfflineCodePossessionProofV2;
  wrapped_mek: OfflineCodeWrappedMekV2;
}>;
