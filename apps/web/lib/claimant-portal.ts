export const claimantPortalCapabilities = {
  authentication: false,
  claimIntake: false,
  emergencyCodeEntry: false,
  evidenceUpload: false,
  review: false,
  release: false,
} as const;

export const claimantInformationRoutes = [
  {
    audience: "Previously nominated by an owner",
    eyebrow: "Route 01 · Planned",
    href: "/claim/registered-recipient",
    key: "registered-recipient",
    summary:
      "A future recipient would authenticate, enroll MFA, register a locally generated public key, and accept the role before an owner can finalize a sealed grant.",
    title: "Registered recipient",
    requirements: [
      "A value-free, single-use invitation from an owner",
      "A separate claimant account with enforced multi-factor authentication",
      "A claimant-generated key pair whose private key remains in the claimant client",
      "Explicit owner finalization and the ability to replace or revoke the sealed grant",
      "A later controlled claim review; registration alone never authorizes release",
    ],
  },
  {
    audience: "Holding private offline instructions",
    eyebrow: "Route 02 · Planned after protocol approval",
    href: "/claim/emergency-code",
    key: "emergency-code",
    summary:
      "A future V2 handover code would separate a public locator from a client-only secret and prove possession without submitting the complete secret.",
    title: "Emergency code",
    requirements: [
      "A new V2 locator-and-secret protocol; existing V1 codes cannot safely locate a claim",
      "No complete emergency secret in a URL, request, log, email, chat, or support message",
      "Enumeration resistance, throttling, attempt limits, expiry, and revocation",
      "Independent identity, evidence, cooldown, cancellation, and authorization checks",
      "Client-local decryption only after an approved encrypted release",
    ],
  },
] as const;

export const claimantPortalStages = [
  {
    title: "Choose the applicable route",
    description: "Registration or code possession establishes context only; neither establishes entitlement.",
  },
  {
    title: "Authenticate and verify separately",
    description: "Account control, MFA, identity, relationship, and evidence are evaluated as distinct controls.",
  },
  {
    title: "Notify and protect the owner",
    description: "The owner receives value-free notices and can cancel while an approved cooldown and review proceed.",
  },
  {
    title: "Authorize through controlled review",
    description: "Non-response never auto-releases the MVP; ambiguous or incomplete cases move to hold or manual review.",
  },
  {
    title: "Release encrypted information",
    description: "An approved case receives a time-limited claimant-addressed ciphertext package for local read-only decryption.",
  },
] as const;

export type ClaimantInformationRoute = (typeof claimantInformationRoutes)[number];
