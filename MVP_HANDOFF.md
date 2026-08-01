# Sanduqkin MVP Handoff

Last updated: 2026-08-01 (Asia/Dubai)

## Current Decision

Finish the mobile owner-vault release gate first. Public website publication, protected owner-web deployment, and claimant implementation remain separate gated workstreams.

Repository reference: PR #52 merged into `main`/`origin/main` at `37b05d0`. The biometric Settings repair is isolated on `codex/biometric-settings-control`.

## MVP Surfaces

| Surface | Intended host | Current state |
| --- | --- | --- |
| Mobile owner vault | Native app | Internal TestFlight testing; iOS biometric gate failed |
| Public website | `sanduqkin.com` | Protected static preview; legal publication blocked |
| Owner web vault | `vault.sanduqkin.com` | Implemented locally; not deployed |
| Claimant portal | `app.sanduqkin.com` | Informational pages only; all runtime disabled |
| Canonical API | `api.sanduqkin.com` | Hono API deployed in `fra1`; no claimant runtime |
| Identity/data | Supabase `eu-central-1` | Existing Free project plus local test stack |

Production hosts remain subject to final security/privacy approval. Use host-only cookies and exact origin/CORS/redirect allowlists; do not rely on path separation between owner and claimant contexts.

## Included Product

- Mobile owner authentication, recovery continuity, encrypted 17-category CRUD, deletion lifecycle, local PDF export, Emergency Readiness, and sealed emergency-code foundation.
- Shared mobile/web validation, ciphertext envelope, and Supabase owner-vault records.
- Protected owner-web authentication and encrypted CRUD implementation, pending deployment gates.
- Static product, support, security, accessibility, privacy, terms, deletion, and inactive claimant information pages.
- Runtime-disconnected claimant protocol contracts, synthetic vectors, threat/decision documents, and native custody feasibility probe.

## Explicitly Excluded

- Public legal publication before owner/counsel approval.
- External authenticated web users before Supabase, backup, session, origin, configuration, and smoke gates pass.
- Live claimant accounts, invitations, evidence upload, case processing, notifications, entitlement decisions, release, or claimant decryption.
- V1 emergency-code lookup, server-side vault decryption, browser-readable release PDFs, automatic release for owner non-response, payments, or financial/legal/executor positioning.

## Current Mobile Finding

Build 6 was submitted and subsequently tested on a physical iPhone. The Settings biometric card/status is a plain `View`; only the conditional enable/disable buttons are pressable. Tapping the card silently does nothing, so physical Face ID setup and the protected-key `Lock` -> `Unlock` path have not passed.

Code review confirms the underlying enablement, authenticated key retrieval, session validation, and password fallback paths are present. Android emulator evidence passed. A corrected interaction and a new controlled candidate are required.

Marriage/divorce certificate options are present in the encrypted Document Locations registry and automated tests. The corrected divorce value has not received fresh hosted persistence evidence.

## Owner Web Contract

- Mobile and web share one Supabase identity and one encrypted vault; do not create a parallel vault.
- Passwords, KEKs, MEKs, and plaintext records remain client-side and are not persisted in browser storage.
- Browser cryptography and the active MEK remain inside the Web Worker.
- Protected pages are private, `no-store`, and `noindex`; lock, sign-out, timeout, displacement, and fatal failures clear decrypted/key state.
- The Hono API remains the canonical privileged surface; durable state belongs in Postgres, not page components or process memory.

## Claimant Product Direction

Status: product-owner approved; specialist approval and evidence pending; runtime `NO-GO`.

- Registered-recipient route first; death-only invitation pilot.
- Claimant authentication/MFA, relationship, documents, or code possession do not authorize release.
- Verified owner notice, provisional 30-day cooldown, owner cancellation, no automatic release for non-response, and two independent reviewers.
- At least two independently enrolled device-bound claimant keys; no server recovery.
- iOS-only preparation is acceptable while Android remains fail-closed. This authorizes documentation, probes, and assurance work only—not runtime integration.
- Future evidence uses private quarantine storage; future delivery remains ciphertext-only with native local decrypt/read-only presentation and optional local PDF export.
- Package served, opened, exported, claimant-confirmed, expired, and closed are separate auditable events; none should be represented as confirmed plaintext receipt without evidence.
- Provisional package availability is 72 hours and retrieval sessions 15 minutes, subject to security/operations approval.
- A safe claimant journey dashboard and append-only internal audit ledger are required.
- Architecture is nationality-neutral, but claims proceed only under an approved, signed/versioned document-specific jurisdiction policy pack.

Detailed decisions and gates live in `CLAIM_HANDOFF.md` and the 2026-07-31 claimant Slice 2 documents.

## Next Actions

1. Repair and test the biometric Settings interaction.
2. Pass protected CI, create the next internal TestFlight candidate, and complete physical-iPhone owner-flow regression.
3. Reverify corrected divorce-certificate encrypted CRUD on the hosted test path.
4. Resolve `apps/web/LEGAL_CONTENT_REVIEW.md` before public publication.
5. Complete Supabase Pro, backup/restore, single-session, JWT, origin, hosted-configuration, monitoring, rollback, and synthetic smoke gates before protected-web deployment.
6. Route the immutable claimant package to named specialists; keep all claimant runtime disabled.

## Verification On 2026-08-01

- Focused mobile tests: 27 passed.
- Shared validation tests: 42 passed.
- Inactive claimant web tests: 6 passed.
- Claim vector, vector-isolation, and custody-isolation guards passed.
