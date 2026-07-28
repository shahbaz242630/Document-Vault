import type {
  claimRouteProfiles,
  claimantActorRoles,
  claimantStates,
} from "./constants";

export type ClaimRouteProfile = (typeof claimRouteProfiles)[number];
export type ClaimantState = (typeof claimantStates)[number];
export type ClaimantActorRole = (typeof claimantActorRoles)[number];
export type AssuranceLevel = "aal1" | "aal2";

export type RecipientGrantPlaintextV1 = {
  protocol: "sanduqkin:claim:recipient-grant:v1";
  grant_id: string;
  owner_id: string;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_fingerprint: string;
  issued_at: string;
  grant_nonce: string;
  mek: string;
};

export type RecipientGrantEnvelopeV1 = {
  protocol: "sanduqkin:claim:recipient-grant:v1";
  algorithm: "crypto_box_seal";
  grant_id: string;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_version: number;
  ciphertext: string;
  created_at: string;
  grant_version: number;
  revoked_at: string | null;
};

export type RecipientPossessionChallengeV2 = {
  protocol: "sanduqkin:claim:recipient-grant:v2";
  challenge_id: string;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_version: number;
  server_ephemeral_public_key: string;
  nonce: string;
  origin: string;
  expires_at: string;
};

export type RecipientGrantPlaintextV2 = {
  protocol: "sanduqkin:claim:recipient-grant:v2";
  grant_id: string;
  owner_id: string;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_version: number;
  recipient_key_fingerprint: string;
  issued_at: string;
  grant_nonce: string;
  mek: string;
};

export type RecipientGrantEnvelopeV2 = {
  protocol: "sanduqkin:claim:recipient-grant:v2";
  profile: "registered_recipient_v2";
  key_agreement: "p256_ecdh";
  kdf: "hkdf_sha256";
  aead: "xchacha20poly1305_ietf";
  grant_id: string;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_version: number;
  owner_ephemeral_public_key: string;
  nonce: string;
  ciphertext: string;
  created_at: string;
  grant_version: number;
  revoked_at: string | null;
};

export type OfflineCodeKdfProfileV2 = {
  algorithm: "argon2id";
  profile_id: string;
  production_approved: boolean;
  opslimit: number;
  memlimit_bytes: number;
  output_bytes: 32;
  salt: string;
};

export type OfflineCodeChallengeV2 = {
  protocol: "sanduqkin:claim:offline-code:v2";
  challenge_id: string;
  nonce: string;
  origin: string;
  expires_at: string;
  locator_hash: string;
};

export type OfflineCodeWrappedMekV2 = {
  protocol: "sanduqkin:claim:offline-code:v2";
  algorithm: "xchacha20poly1305_ietf";
  locator_record_id: string;
  locator_version: number;
  grant_id: string;
  owner_id: string;
  created_at: string;
  kdf_profile_id: string;
  proof_key_version: number;
  nonce: string;
  ciphertext: string;
};

export type ClaimTransitionPredicatesV1 = {
  account_active: boolean;
  approvals_current: boolean;
  authorization_rechecked: boolean;
  claimant_binding_valid: boolean;
  cooldown_expired: boolean;
  evidence_policy_satisfied: boolean;
  grant_or_code_current: boolean;
  hold_disposition_recorded: boolean;
  hold_reviewable: boolean;
  intake_enabled: boolean;
  no_cancellation_or_hold: boolean;
  notice_enqueued: boolean;
  notice_verified_delivered: boolean;
  package_build_enabled: boolean;
  package_current: boolean;
  policy_accepted: boolean;
  policy_deadline_exceeded: boolean;
  review_result_recorded: boolean;
  release_material_current: boolean;
  release_retrieval_enabled: boolean;
  retention_scheduled: boolean;
  route_profile_valid: boolean;
  session_unexpired: boolean;
  supported_jurisdiction: boolean;
  two_independent_approvals: boolean;
};

export type ClaimTransitionRequestV1 = {
  protocol: "sanduqkin:claim:state:v1";
  previous_state: ClaimantState | null;
  requested_state: ClaimantState;
  actor_role: ClaimantActorRole;
  assurance_level: AssuranceLevel;
  expected_version: number;
  server_time: string;
  predicates: ClaimTransitionPredicatesV1;
};

export type ClaimTransitionResultV1 =
  | {
      allowed: true;
      result_class: "allowed";
      invalidates: string[];
    }
  | {
      allowed: false;
      result_class:
        | "actor_forbidden"
        | "assurance_required"
        | "predicate_failed"
        | "transition_forbidden";
      invalidates: [];
    };

export type RegisteredRecipientReleaseMaterialV1 = {
  profile: "registered_recipient_v1";
  grant_id: string;
  grant_version: number;
  recipient_id: string;
  recipient_key_id: string;
  recipient_key_version: number;
  sealed_grant_digest: string;
};

export type OfflineCodeReleaseMaterialV2 = {
  profile: "offline_code_v2";
  locator_record_id: string;
  locator_version: number;
  kdf_profile_id: string;
  proof_key_version: number;
  wrapped_mek_digest: string;
};

export type ReleaseMaterialProfile =
  | RegisteredRecipientReleaseMaterialV1
  | OfflineCodeReleaseMaterialV2;

export type ReleaseManifestV1 = {
  protocol: "sanduqkin:claim:release-package:v1";
  claim_id: string;
  release_package_id: string;
  owner_id: string;
  claimant_id: string;
  claim_version: number;
  cancellation_version: number;
  created_at: string;
  expires_at: string;
  asset_snapshot_boundary: string;
  asset_ciphertext_digests: string[];
  policy_decision_version: number;
  signing_key_id: string;
  release_material: ReleaseMaterialProfile;
};

export type SignedReleasePackageV1 = {
  protocol: "sanduqkin:claim:release-package:v1";
  signature_algorithm: "ed25519";
  manifest: ReleaseManifestV1;
  manifest_signature: string;
};
