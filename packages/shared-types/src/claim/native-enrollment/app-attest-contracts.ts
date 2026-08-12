export type AppAttestEnvironmentV1 = "development" | "production";
export type AppAttestValidationCategoryV1 = 2 | 3 | 4;

export type AppAttestRegistrationChallengeV1 = Readonly<{
  api_audience: string;
  app_attest_key_id_digest: string;
  app_id_hash: string;
  challenge_id: string;
  claimant_id: string;
  environment: AppAttestEnvironmentV1;
  required_bundle_version: string;
  required_validation_category: AppAttestValidationCategoryV1;
  expires_at: string;
  issued_at: string;
  nonce: string;
  portal_session_id: string;
  protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1";
}>;

export type AppAttestRegistrationResponseV1 = Readonly<{
  app_attest_key_id: string;
  attestation_object: string;
  challenge_id: string;
  protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1";
}>;

export type AppAttestAssertionChallengeV1 = Readonly<{
  api_audience: string;
  app_attest_key_id_digest: string;
  app_id_hash: string;
  challenge_id: string;
  claimant_id: string;
  claimant_key_id: string;
  claimant_key_version: number;
  environment: AppAttestEnvironmentV1;
  required_bundle_version: string;
  required_validation_category: AppAttestValidationCategoryV1;
  expires_at: string;
  invitation_reference: string;
  invitation_version: number;
  issued_at: string;
  native_enrollment_challenge_digest: string;
  nonce: string;
  portal_session_id: string;
  protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1";
  public_key_fingerprint: string;
}>;

export type AppAttestAssertionResponseV1 = Readonly<{
  app_attest_key_id: string;
  assertion_object: string;
  challenge_id: string;
  protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1";
}>;

export type AppAttestSyntheticFixtureV1 = Readonly<{
  assertion_challenge: AppAttestAssertionChallengeV1;
  assertion_response: AppAttestAssertionResponseV1;
  registration_challenge: AppAttestRegistrationChallengeV1;
  registration_response: AppAttestRegistrationResponseV1;
}>;
