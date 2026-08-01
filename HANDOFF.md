# Sanduqkin Project Handoff

Last updated: 2026-08-01 (Asia/Dubai)

## Current Decision

The next product step is to repair the mobile Settings biometric interaction, produce the next controlled TestFlight candidate, and complete physical-iPhone regression. Claimant runtime remains `NO-GO`.

## Repository Snapshot

- Working branch: `codex/biometric-settings-control`, based on merged `main` at `37b05d0`.
- Base/release branch: `main` and `origin/main` at `37b05d0` (PR #52).
- PR #52 merged the claimant Slice 2 review package and divorce-certificate correction into `main`.
- Preserve unrelated local-only items such as `.codex-runtime/`.

## Verified Product State

### Mobile owner vault

- App version is `1.0.0`; TestFlight build 6 was submitted from `9a903f2` and was subsequently exercised on a physical iPhone.
- Build 6 did not complete the iOS release gate. The `Biometric unlock` status/card is non-interactive; only its conditional enable/disable buttons have press handlers. A tap on the card therefore appears to do nothing.
- The underlying flow is implemented: enablement authenticates before caching the MEK, lock-screen restoration uses one authenticated SecureStore read, stale remote restoration requires a live Supabase session, and password fallback remains available.
- Android emulator evidence passed. Physical Face ID enablement and `Lock` -> `Unlock` remain unverified.
- Marriage and divorce certificate values exist in the encrypted Document Locations registry and automated tests. The corrected divorce value still needs fresh hosted create/edit/reload/delete verification.

### Owner web vault and public site

- Mobile and web share the same Supabase identity, `vault_key_material`, `vault_assets`, envelope format, and 17-category validation registry.
- The protected owner web vault is implemented locally but not deployed.
- The hosted web preview is static and protected; it has no production domain or Supabase environment variables.
- Public legal content remains a draft. Do not publish until `apps/web/LEGAL_CONTENT_REVIEW.md` is resolved and owner/counsel approval is recorded.

### Claimant work

- `/claim` is informational only. Authentication, intake, evidence, review, notifications, release, and claimant decryption are disabled.
- Product-owner direction is recorded, but legal/privacy, security, operations, native custody, and independent approvals remain incomplete.
- Shahbaz Malik is the provisionally designated operator/data controller candidate. Incorporation, legal confirmation, controller contact details, and the processor map remain incomplete, so no real claimant data may be collected.
- `CLAIM_HANDOFF.md` is authoritative for claimant scope and stop gates.

## Non-Negotiable Boundaries

- Vault encryption and decryption remain client-side. Infrastructure stores ciphertext and approved metadata only.
- Never log or transmit plaintext vault fields, passwords, recovery phrases, raw MEKs, private keys, or complete emergency secrets.
- Claimant authentication, relationship, evidence, MFA, or code possession never authorizes release by itself.
- Claimants never receive a policy path to owner vault tables or another claimant's data.
- Public, owner, claimant, and API origins require explicit isolation before deployment.
- Do not deploy the protected vault, attach production domains, change Supabase Auth globally, publish draft legal content, or enable claimant runtime without the recorded gates.

## Next Actions

1. Make the biometric Settings control discoverable and accessible; test the actual enable/disable action rather than treating the whole card as inert status.
2. Run focused mobile tests, the protected CI matrix, and create the next controlled internal TestFlight candidate.
3. Complete value-free physical-iPhone QA: enablement, background lock, Face ID success/cancel/error, password fallback, returning-user recovery, trusted-person information navigation, Emergency Readiness, sealed-code state, and encrypted certificate CRUD.
4. Route one immutable claimant review set to named legal/privacy, security, operations, native, and independent reviewers. Capture approver, version, decision, conditions, evidence, and expiry.
5. Keep claimant Slice 3 at `NO-GO` until every blocking checklist item is approved.

## Current Release Blockers

- Physical iOS biometric regression and corrected divorce-certificate persistence evidence.
- Supabase Pro, backup/restore drill, single-session policy, JWT lifetime, and displacement testing before external protected-web use.
- Production owner/claimant origin decision and deployment review.
- Public legal approval.
- Transactional-email provider, operational ownership, second qualified security reviewer, and durable SBOM/license ownership.
- Legal confirmation of Shahbaz Malik as operator/data controller, contracting-entity and processor mapping, jurisdiction policy packs, evidence/retention rules, reviewer staffing, native custody proof, audit integrity, and independent assurance.

## Verification Recorded On 2026-08-01

- Focused mobile security/settings/certificate/custody tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vectors, claimant-vector isolation, and claimant-custody isolation guards passed.
- Code inspection confirmed the biometric card interaction defect, hard-disabled claimant capabilities, and hard-disabled custody probe.

For a release candidate, also run the repository verification matrix and the protected `iOS TestFlight release` workflow from `main`; record only value-free device/build/pass-fail evidence.
