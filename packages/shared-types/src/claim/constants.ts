export const claimProtocolVersions = {
  claimState: "sanduqkin:claim:state:v1",
  offlineCode: "sanduqkin:claim:offline-code:v2",
  recipientGrant: "sanduqkin:claim:recipient-grant:v1",
  recipientGrantV2: "sanduqkin:claim:recipient-grant:v2",
  releasePackage: "sanduqkin:claim:release-package:v1",
} as const;

export const claimRouteProfiles = [
  "registered_recipient_v1",
  "offline_code_v2",
] as const;

export const claimKdfContext = "SKCLMV2!" as const;

export const claimantStates = [
  "draft",
  "identity_pending",
  "submitted",
  "owner_notified",
  "cooldown",
  "review_pending",
  "approved",
  "release_ready",
  "released",
  "closed",
  "cancelled_by_owner",
  "withdrawn_by_claimant",
  "rejected",
  "expired",
  "on_hold",
  "manual_review",
  "release_suspended",
] as const;

export const claimantActorRoles = [
  "claimant",
  "owner",
  "processor",
  "timer_processor",
  "reviewer",
  "case_lead",
  "security",
] as const;
