export type NativeEnrollmentCapabilityV1 = Readonly<{
  claimed_hardware_security_level: "secure_enclave";
  key_algorithm: "p256_ecdh";
  platform: "ios";
  claimed_private_key_exportable: false;
  protocol: "sanduqkin:claim:native-enrollment:v1";
  public_key_encoding: "ansi_x9_63_uncompressed";
  claimed_user_presence_binding: "transaction_bound";
}>;

export type NativeEnrollmentChallengeRequestV1 = Readonly<{
  capability: NativeEnrollmentCapabilityV1;
  invitation_reference: string;
  policy_pack_id: string;
  policy_pack_version: number;
  protocol: "sanduqkin:claim:native-enrollment:v1";
  public_key: string;
}>;

export type NativeEnrollmentChallengeV1 = Readonly<{
  challenge_id: string;
  claimant_id: string;
  claimant_key_id: string;
  claimant_key_version: number;
  device_binding_digest: string;
  eligibility_version: number;
  expires_at: string;
  invitation_reference: string;
  invitation_version: number;
  issued_at: string;
  kdf_salt: string;
  nonce: string;
  origin: string;
  policy_pack_id: string;
  policy_pack_version: number;
  protocol: "sanduqkin:claim:native-enrollment:v1";
  public_key_fingerprint: string;
  server_ephemeral_public_key: string;
}>;

export type NativeEnrollmentPossessionProofV1 = Readonly<{
  challenge_id: string;
  claimant_id: string;
  claimant_key_id: string;
  claimant_key_version: number;
  device_binding_digest: string;
  invitation_reference: string;
  proof_mac: string;
  protocol: "sanduqkin:claim:native-enrollment:v1";
  public_key_fingerprint: string;
}>;

export type NativeEnrollmentIssuedChallengeV1 = Readonly<{
  challenge: NativeEnrollmentChallengeV1;
  challenge_bytes: string;
}>;

export type NativeEnrollmentSyntheticFixtureV1 = Readonly<{
  challenge: NativeEnrollmentChallengeV1;
  challenge_bytes: string;
  challenge_request: NativeEnrollmentChallengeRequestV1;
  possession_proof: NativeEnrollmentPossessionProofV1;
}>;
