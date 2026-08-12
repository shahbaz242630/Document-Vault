export const APP_ATTEST_REGISTRATION_PROTOCOL_V1 =
  "sanduqkin:claim:native-enrollment:app-attest-registration:v1" as const;
export const APP_ATTEST_ASSERTION_PROTOCOL_V1 =
  "sanduqkin:claim:native-enrollment:app-attest-assertion:v1" as const;
export const APP_ATTEST_KEY_ID_DIGEST_LABEL_V1 =
  "sanduqkin:claim:native-enrollment:app-attest-key-id:v1" as const;
export const APP_ATTEST_CHALLENGE_TTL_SECONDS_V1 = 300 as const;
// Bundle-version and validation-category authenticator extensions are available
// beginning with iOS 27. Claimant enrollment fails closed when either is absent.
export const APP_ATTEST_REQUIRED_IOS_MAJOR_VERSION_V1 = 27 as const;
