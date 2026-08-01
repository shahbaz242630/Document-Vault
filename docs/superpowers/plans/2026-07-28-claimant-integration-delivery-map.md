# Claimant Integration And End-To-End Delivery Map

Last updated: 2026-07-31 (Asia/Dubai)

## Status

Owner-approved delivery map. This document does not by itself authorize claimant authentication, persistence, migrations, API routes, evidence intake, notifications, review processing, release packaging, or claimant decryption.

Stage 1 protocol contracts/vectors and the later hard-disabled custody feasibility slice are complete and merged through PR #38. All claimant capabilities remain hard-disabled. The owner permits iOS-only Stage 2 preparation with Android fail-closed, but Stage 2 remains blocked on physical iOS custody evidence, operator and specialist approvals, independent review, and an approved multi-device implementation design.

The Slice 2 decision-closure package is now drafted:

- `docs/superpowers/specs/2026-07-31-claimant-slice-2-decision-register.md`;
- `docs/superpowers/specs/2026-07-31-claimant-threat-control-matrix.md`;
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-approval-checklist.md`;
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-specialist-review-pack.md`;
- `docs/superpowers/specs/2026-07-31-claimant-document-checklist-catalog.md`; and
- `docs/superpowers/specs/2026-07-31-claimant-mvp-manual-review-retrieval-flow.md`.

Its current result is `NO-GO` for Stage 2/Slice 3 runtime preparation. Owner/product decisions are approved, including a nationality-neutral global architecture with versioned document/jurisdiction policy packs. The documents identify outstanding operator, legal, privacy, security, operations and independent-review evidence; owner approval cannot substitute for those specialist decisions.

## Product Outcome

Sanduqkin lets an owner prepare encrypted vault information for a trusted recipient. If the owner dies or becomes unable to communicate, a registered recipient or an offline-code holder may apply for access.

Neither route automatically authorizes access. Authentication, MFA, route possession, identity, evidence, owner protection, human review, and release authorization remain separate controls.

After an approved release, Sanduqkin provides a claimant-specific encrypted, read-only package. The claimant client decrypts it locally. Sanduqkin infrastructure never receives plaintext vault records, a raw MEK, a claimant private key, or a complete emergency secret.

## Two Preparation Routes

### Registered recipient

1. The owner nominates a recipient using a value-free invitation.
2. The recipient authenticates, enrolls MFA, and creates or links the intended claimant account.
3. An approved claimant client generates the recipient key pair locally.
4. Only the public key is registered.
5. The unlocked owner client explicitly seals a MEK grant to that public key.
6. The owner may replace or revoke the recipient grant before release.

Runtime implementation remains blocked until a reviewed claimant-key custody design exists. The current browser boundary does not permit persistent claimant private keys, and Sanduqkin must not provide server-recoverable private-key custody.

### V2 offline handover code

1. The unlocked owner client creates a random public locator and a separate high-entropy client-only secret.
2. The owner gives the offline kit to a trusted person outside Sanduqkin.
3. A future claimant client uses the locator to request a bounded challenge.
4. The client proves possession using a domain-separated derived proof key without transmitting the secret.
5. A successful proof establishes route possession only; it does not establish identity, entitlement, approval, or release.

Existing V1 codes cannot safely initiate a public claim because they have no public locator. They remain backward-compatible owner setup artifacts until the owner deliberately creates and confirms a V2 kit.

## Where The Routes Converge

The routes have different preparation and release material, but converge only after the claimant has an authenticated `aal2` session and a valid route assertion.

| Stage | Registered recipient | V2 offline code | Shared control |
| --- | --- | --- | --- |
| Route assertion | Accepted invitation, current claimant key, active owner grant | Valid locator challenge and possession proof | Establishes context only |
| Application | Account and grant bindings are rechecked | Account and possession assertion are bound | Supported jurisdiction and accepted policy |
| Identity/evidence | Approved claimant and authority evidence | Approved claimant and authority evidence | Private quarantine if policy requires documents |
| Owner protection | Value-free owner notice | Value-free owner notice | Verified delivery, cancellation, cooldown, disputes |
| Review | Route and grant/key version checked | Locator/proof/wrap version checked | Two independent qualified human decisions |
| Package | Recipient-specific sealed MEK grant | V2 secret-wrapped MEK | Immutable ciphertext snapshot and signed manifest |
| Retrieval | Claimant private key opens the grant locally | Client-only secret derives the unwrap key locally | Fresh `aal2`, bounded session, read-only viewer |

The route discriminator is immutable once a claim is submitted. Registered-recipient and V2 release material cannot be substituted for each other.

## Sequenced Delivery Map

### Stage 0 — approval and operating prerequisites

- Resolve claimant-key custody and approved client surface.
- Approve the production origin split for owner, claimant, reviewer, and public surfaces.
- Obtain qualified legal/privacy decisions for authority, supported jurisdictions, evidence, retention, deletion, disputes, incidents, and controller responsibilities.
- Establish two qualified human reviewers with enforceable separation of duties.
- Complete independent security assurance for the selected protocols and custody model.
- Define backup, Storage backup, restore, monitoring, support, and incident ownership.

No stateful claimant implementation is authorized by Stage 0 planning work.

### Stage 1 — protocol contracts and synthetic vectors

- Define closed, versioned TypeScript contracts for:
  - registered-recipient grant V1;
  - offline code V2;
  - claimant state V1; and
  - release package V1.
- Add reviewed offline generators and deterministic synthetic fixtures.
- Add validation, negative cases, transition invariants, and unknown-version rejection.
- Verify fixtures independently across shared reference tests and, where practical, mobile, web, and API consumers.

No runtime integration.

### Stage 2 — registered-recipient preparation

- Add value-free, single-use invitation binding.
- Require verified normalized-address matching and fresh `aal2`.
- Register and replace claimant public keys only after custody approval.
- Let the unlocked owner client finalize, replace, and revoke recipient-addressed grants.
- Keep claim submission and release disabled.
- Establish the approved append-only audit-event baseline before the first claimant invitation, account binding, or key-registration mutation; events are server-authored and value-free.
- Establish the signed/versioned jurisdiction-policy and dynamic-document-checklist contracts with no active release policy and no universal fallback.

Exit requires hostile authentication, RLS, cryptographic, invitation-replay, and cross-account tests.

### Stage 3 — V2 initiation and evidence quarantine

- Add V2 locator challenges, possession proofs, enumeration resistance, and layered rate limits.
- Create only a controlled claim draft/assertion after successful possession.
- If policy has been approved, add synthetic evidence quarantine, scanning, retention, deletion, and reviewer-bound access.
- Render the minimum common checklist plus an approved policy-pack overlay from claim facts; unsupported or conflicting combinations enter hold/manual review.
- Keep review progression and release disabled.

Exit requires abuse, Storage RLS, malware, privacy, backup, restore, and cleanup tests.

### Stage 4 — controlled review workflow

- Add the allowlisted state machine, append-only events, idempotent transitions, and transactional outbox.
- Add a read-only claimant journey dashboard as a safe public-state projection, separate from reviewer, owner-notice, fraud, and security state.
- Reconcile case state, append-only events, notification outbox, and dashboard projection; gaps or divergence fail to hold/manual review.
- Add verified owner notice, cancellation, cooldown, holds, disputes, and two independent approvals.
- Prevent non-response, delivery failure, timers, or one reviewer from approving or releasing.
- Keep package build and retrieval disabled.

Exit requires state-property, race, replay, authorization, retry, notification, and audit/outbox reconciliation tests.

### Stage 5 — encrypted release and claimant viewer

- Build an immutable ciphertext snapshot with exactly one route-specific release-material profile.
- Sign and validate the canonical manifest and ciphertext digests.
- Issue fresh-`aal2`, time-limited retrieval sessions.
- Decrypt only in the approved claimant client into a memory-only, read-only viewer.
- Add expiry, suspension, incident controls, and explicit limits on recall.

Exit requires a focused independent security review or penetration test, restore drill, synthetic end-to-end verification, and owner approval before an invitation-only pilot.

## First Bounded Implementation Slice

### Objective

Create a runtime-disconnected claimant protocol package that makes the four approved-version boundaries executable and testable before schemas, APIs, or user flows depend on them.

### Deliverables

1. `packages/shared-types/src/claim/`
   - closed protocol/version discriminators;
   - canonical data contracts;
   - validators that reject unknown versions and unknown route profiles;
   - claimant state and transition request/result types;
   - release manifest and route-specific material contracts.
2. `packages/shared-types/test-vectors/claim/`
   - `recipient-grant-v1.json`;
   - `offline-code-v2.json`;
   - `claim-state-v1.json`;
   - `release-package-v1.json`.
3. A reviewed generator under `scripts/` that uses fixed, explicitly synthetic seeds and identifiers and overwrites only those four generated fixtures.
4. Shared reference tests for canonicalization, cryptographic results, bindings, invalid cases, state invariants, and closed version handling.
5. Consumer verification tests in mobile, web, and API that read the same fixtures without connecting them to runtime authentication, storage, or network code.

### Required design decisions inside the slice

- Canonical JSON serialization rules.
- Base64url encoding and padding rules.
- Exact protocol and domain-separation labels.
- Fixed UUID, timestamp, integer, byte-length, and size constraints.
- Cryptographic primitive identifiers and parameter-version representation.
- State transition input predicates, result classes, and invalidation representation.
- Release manifest signing-key representation and validation boundary.

Any decision that changes the cryptographic design in the Slice 2 approval package returns to owner/security review before being encoded.

### Non-goals

- No claimant UI changes.
- No claimant authentication or MFA integration.
- No database migration, RLS policy, Storage bucket, or Supabase connection.
- No Hono API route or processor.
- No invitation, email, evidence, reviewer, cooldown, approval, or release behavior.
- No change to installed-client V1 emergency grants.
- No production identifier, key, secret, ciphertext, account, or document.
- No claimant private-key persistence or custody implementation.

### Acceptance tests

- Every fixture is reproducible from the reviewed generator.
- Fixtures contain an explicit synthetic marker and only fixed test identifiers and secrets.
- Registered-recipient vectors open with the expected test key and fail for wrong keys, bindings, truncation, or version.
- V2 vectors reproduce locator formatting, proof derivation/signature, wrapping, and unwrapping and fail for changed locator, origin, expiry, bindings, secret, signature, ciphertext, KDF profile, or version.
- State vectors cover every allowlisted and denied transition.
- Property tests prove no path reaches `release_ready` or `released` without route validity, fresh `aal2`, verified owner notice, expired cooldown, no cancellation/hold, two independent current approvals, and an enabled release path.
- Release-package vectors validate both route profiles and reject missing discriminators, cross-route substitution, stale material, cancellation-version changes, digest reordering, unknown signing keys, expiry, and binding mismatches.
- Mobile, web, API, and the reference runner agree on canonical bytes and validation results where the primitive is supported.
- A repository scan confirms that the fixtures and tests have no runtime imports or network, Supabase, Storage, email, evidence, notification, or processor integration.
- Standard repository typecheck, lint, test, build, and security guards pass.

### Rollback and kill switch

This slice creates no runtime capability, so rollback is removal or reversion of the isolated contracts, generator, fixtures, and tests.

The existing hard-disabled claimant capability model remains unchanged and is tested as disabled. No environment variable or hosted configuration can activate the new protocol package.

### Owner stop gate

After the contracts and fixtures pass review and verification:

1. record value-free test evidence;
2. confirm no runtime claimant path was introduced;
3. update the active handoffs with the approved protocol versions;
4. stop for owner review; and
5. do not begin registered-recipient runtime preparation until claimant-key custody and the applicable Stage 0 gates are explicitly approved.

## Decisions Still Pending

The following remain blockers, not implementation assumptions:

- approved Android transaction binding and minimum platform baseline;
- physical iOS and representative Android custody evidence;
- claimant private-key recovery or multi-device policy;
- production host/origin boundaries;
- launch jurisdiction and evidence policy;
- legal release authority and reviewer qualifications;
- exact retention/deletion/legal-hold schedule;
- approved cooldown, package lifetime, and retrieval-session lifetime;
- identity/evidence vendors, if any;
- transactional email provider;
- two-human reviewer availability;
- independent security and privacy assurance;
- production backup and restore strategy.

The proposed values in the Slice 2 approval package—registered-recipient first, 30-day cooldown, 72-hour package availability, 15-minute retrieval session, and dual independent approval—remain proposed until their required approvals are recorded.
