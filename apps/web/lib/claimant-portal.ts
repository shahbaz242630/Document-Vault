export const claimantPortalCapabilities = {
  adminCaseNotification: false,
  authentication: false,
  claimIntake: false,
  emergencyCodeEntry: false,
  evidenceUpload: false,
  localClaimantDecryption: false,
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
    startSteps: [
      "Sign in with the account previously registered through the approved recipient setup",
      "Complete fresh multi-factor authentication and recheck the active recipient key and owner grant",
      "Open a new application under the approved jurisdiction and evidence policy",
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
    startSteps: [
      "Sign in or create the claimant account and complete multi-factor authentication",
      "Enter the future V2 locator and secret only in a protected local client; submit a possession proof, never the complete secret",
      "Open a new application only after the proof is bound to the authenticated claimant session",
    ],
  },
] as const;

export const claimantEvidenceChecklist = [
  {
    key: "claimant-identity",
    title: "Claimant identity",
    description:
      "Approved identity documents and verification results for the person making the application.",
  },
  {
    key: "owner-reference",
    title: "Owner reference",
    description:
      "The minimum approved information needed to bind the application without exposing whether an unrelated owner account exists.",
  },
  {
    key: "authority-relationship",
    title: "Authority or relationship",
    description:
      "Jurisdiction-approved evidence supporting the claimed authority or relationship; registration or code possession is not enough.",
  },
  {
    key: "trigger-evidence",
    title: "Claim trigger",
    description:
      "Policy-approved evidence of the event or incapacity relied on for the application.",
  },
  {
    key: "declarations",
    title: "Declarations and consent",
    description:
      "Current privacy notice, truthful-submission declaration, contact consent, and dispute acknowledgements.",
  },
] as const;

export const claimantApplicationStatuses = [
  {
    key: "account-verified",
    label: "Account verified",
    description: "Account control and multi-factor authentication are checked separately from entitlement.",
  },
  {
    key: "documents-needed",
    label: "Documents needed",
    description: "The portal shows the approved checklist and safe processing states for private quarantine uploads.",
  },
  {
    key: "submitted",
    label: "Application submitted",
    description: "A value-free email can notify the admin team that a case needs attention; documents are not emailed.",
  },
  {
    key: "owner-protection",
    label: "Owner protection period",
    description: "Owner notice, cancellation, delivery checks, and the approved cooldown must complete without a dispute.",
  },
  {
    key: "human-review",
    label: "Human review",
    description: "Authorized reviewers inspect only the claimant evidence required by policy and record independent decisions.",
  },
  {
    key: "decision",
    label: "Decision",
    description: "The claimant sees approved, rejected, on-hold, or more-information-needed status with safe reason classes.",
  },
  {
    key: "encrypted-release",
    label: "Encrypted release",
    description: "An approved claimant receives a time-limited encrypted package that opens locally in a read-only client.",
  },
] as const;

export const claimantDataBoundaries = [
  {
    title: "Evidence is quarantined",
    description:
      "Identity and authority documents go to a private case-bound quarantine. Email carries a value-free work notice, not attachments, filenames, or personal information.",
  },
  {
    title: "Review is deliberately limited",
    description:
      "Assigned reviewers may need to see claimant-submitted evidence. They never receive owner vault plaintext, a raw MEK, a claimant private key, or the complete offline secret.",
  },
  {
    title: "Vault details stay encrypted",
    description:
      "Approval creates claimant-addressed ciphertext. The claimant downloads and decrypts it locally; Sanduqkin staff and infrastructure cannot read the vault contents.",
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
