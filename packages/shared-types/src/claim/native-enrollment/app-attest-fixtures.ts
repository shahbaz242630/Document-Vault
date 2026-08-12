import type { AppAttestSyntheticFixtureV1 } from "./app-attest-contracts";

const appAttestKeyId = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=";

export const appAttestSyntheticFixtureV1: AppAttestSyntheticFixtureV1 = {
  registration_challenge: {
    api_audience: "https://api.sanduqkin.test",
    protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1",
    challenge_id: "71000000-0000-4000-8000-000000000001",
    claimant_id: "21000000-0000-4000-8000-000000000002",
    portal_session_id: "81000000-0000-4000-8000-000000000018",
    app_attest_key_id_digest: "jP4NkV0WjX762GwRU5O2vPj-rjWWDUmYJ2B_xhx1xa8",
    app_id_hash: "pBqNY_Of9T6MEL7tai_qACvWZAiKOcCck1SmYmuA2dc",
    environment: "production",
    required_bundle_version: "1",
    required_validation_category: 2,
    issued_at: "2026-07-28T08:00:00.000Z",
    expires_at: "2026-07-28T08:05:00.000Z",
    nonce: "UVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3A",
  },
  registration_response: {
    protocol: "sanduqkin:claim:native-enrollment:app-attest-registration:v1",
    challenge_id: "71000000-0000-4000-8000-000000000001",
    app_attest_key_id: appAttestKeyId,
    attestation_object:
      "kZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0A==",
  },
  assertion_challenge: {
    protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1",
    challenge_id: "71000000-0000-4000-8000-000000000002",
    claimant_id: "21000000-0000-4000-8000-000000000002",
    claimant_key_id: "31000000-0000-4000-8000-000000000013",
    claimant_key_version: 1,
    public_key_fingerprint: "Vg3N0myu8j92y2q7HRooneBJYEGM7xeUbabp2liJ42M",
    invitation_reference: "51000000-0000-4000-8000-000000000005",
    invitation_version: 2,
    portal_session_id: "81000000-0000-4000-8000-000000000018",
    app_attest_key_id_digest: "jP4NkV0WjX762GwRU5O2vPj-rjWWDUmYJ2B_xhx1xa8",
    app_id_hash: "pBqNY_Of9T6MEL7tai_qACvWZAiKOcCck1SmYmuA2dc",
    environment: "production",
    required_bundle_version: "1",
    required_validation_category: 2,
    native_enrollment_challenge_digest: "AEBArphRs3mWVrpsUwgLY2SMA1hGNqriJmtDDYGAJvA",
    api_audience: "https://api.sanduqkin.test",
    issued_at: "2026-07-28T08:10:00.000Z",
    expires_at: "2026-07-28T08:15:00.000Z",
    nonce: "cXJzdHV2d3h5ent8fX5_gIGCg4SFhoeIiYqLjI2Oj5A",
  },
  assertion_response: {
    protocol: "sanduqkin:claim:native-enrollment:app-attest-assertion:v1",
    challenge_id: "71000000-0000-4000-8000-000000000002",
    app_attest_key_id: appAttestKeyId,
    assertion_object: "0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8A",
  },
};
