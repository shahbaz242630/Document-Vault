# Claim Protocol, Authority, And Threat-Model Approval Package

Last updated: 2026-07-21 (Asia/Dubai)

## Status

Proposed Slice 2 approval baseline. This document is design-only. It does not authorize a claimant migration, authenticated claimant route, evidence upload, state transition, notification, release package, or live claim.

Stateful claimant implementation remains blocked until the approval record at the end of this document is completed by the owner, security reviewer, and qualified legal/privacy reviewer. While review is pending, the only permitted claimant work is documentation, versioned synthetic test-vector tooling that has no runtime integration, and the existing static information-only pages with every capability hard-disabled. Authentication, persistence, migrations, API routes, invitations, evidence handling, notifications, workflow processors, and release behavior remain forbidden. Any rejected or changed decision requires this package and its test-vector plan to be revised before implementation.

## Slice Outcome

This package defines:

- the recommended release-authority and human-review baseline;
- separate registered-recipient and V2 offline-code protocols;
- versioned message and cryptographic envelope contracts;
- roles, capabilities, and state transitions;
- evidence, notification, retention, and origin boundaries;
- abuse cases and required security tests;
- kill switches, rollback rules, and recovery behavior; and
- the test vectors that must exist before a stateful claimant slice.

It deliberately does not choose a launch jurisdiction, make a legal entitlement determination, name a production identity/evidence vendor, or approve real claimant data. Those decisions require qualified review.

## Non-Negotiable Invariants

1. Authentication, `aal2`, invitation or code possession, identity proofing, relationship evidence, human review, cooldown, and release authorization are independent controls.
2. No single person, credential, code, reviewer, scheduled job, notification result, or client-supplied value can authorize release.
3. Sanduqkin infrastructure never receives plaintext vault fields, a raw MEK, a claimant private key, or a complete V1/V2 emergency secret.
4. The owner client creates grants while unlocked. A claimant client decrypts an authorized release locally.
5. Claimants never receive a direct RLS or Storage path to owner source rows, `vault_key_material`, another claim, or another claimant's evidence.
6. Owner non-response, delivery failure, ambiguity, dispute, inconsistent evidence, reviewer conflict, or processor failure produces a hold; it never produces approval.
7. Every security-sensitive transition is allowlisted, transactional, idempotent, append-only in history, based on server time, and re-authorized at execution.
8. Claim-sensitive actions require a fresh session and enforced `aal2` in the client, API, and database capability.
9. Development and pre-pilot verification use dedicated identities, synthetic records, and synthetic documents only.
10. Already decrypted information cannot be recalled. Suspension stops future retrieval and must not claim otherwise.

## Approval Decisions

The following baseline is recommended for an invitation-only MVP. “Approve” means accepting the baseline after jurisdiction-specific review; it does not mean turning the feature on.

| ID | Decision | Proposed baseline | Required approval |
| --- | --- | --- | --- |
| A-01 | Release authority | Sanduqkin may execute release only under a written, jurisdiction-approved operating policy after two independent qualified human approvals. Sanduqkin does not certify next-of-kin status. | Owner + legal + security |
| A-02 | Claim routes | Registered recipient ships first. V2 offline-code initiation remains separately gated. V1 is never accepted for public lookup. | Owner + security |
| A-03 | Owner control | The owner may cancel at any time before package retrieval. Cancellation invalidates prior decisions and packaging work. | Owner + legal |
| A-04 | Non-response | Non-response or failed delivery moves the claim to `on_hold`; no timer can approve or release. | Owner + legal + security |
| A-05 | Review separation | Two different authorized reviewers are required. A reviewer cannot be the claimant, owner, inviter, evidence submitter, case assignee with a conflict, or both approvers. | Owner + legal + security |
| A-06 | Cooldown | Proposed minimum is 30 calendar days beginning only after verified value-free owner notice. Material claim, identity, evidence, grant, or claimant-key changes restart the cooldown. | Owner + legal |
| A-07 | Jurisdiction | Production allowlist defaults empty. A claim can be submitted only for an explicitly approved jurisdiction and evidence policy version. | Owner + legal |
| A-08 | Evidence | Evidence is optional at the architecture level but mandatory when an approved policy requires it. It is server-visible sensitive PII in an isolated quarantine, not zero-knowledge vault data. | Legal + privacy + security |
| A-09 | Release scope | Release is a claimant-specific, immutable ciphertext snapshot plus claimant-addressed sealed key material. It is read-only and does not expose live owner tables. | Owner + security |
| A-10 | Release lifetime | Proposed package availability is 72 hours; proposed retrieval session lifetime is 15 minutes with fresh `aal2`. Values remain configuration blocked until approved. | Owner + security + legal |
| A-11 | Retention | No default retention is inferred. Evidence, workflow metadata, security events, backups, legal hold, and release artifacts require a record-level approved schedule before collection. | Legal + privacy + security |
| A-12 | Disputes | Any owner response, competing claim, fraud signal, identity inconsistency, appeal, court-order ambiguity, or support escalation suspends progression and requires manual disposition. | Legal + operations + security |
| A-13 | Key replacement | Claimant-key replacement revokes unconsumed grants. During an active claim it also invalidates approvals and returns the claim to `on_hold` until the owner finalizes a new grant and review restarts. | Owner + security |
| A-14 | Account deletion | Owner or claimant deletion cannot silently cascade an active case into release. The case is suspended and handled under the approved deletion/legal-hold policy. | Legal + privacy + security |
| A-15 | Pilot | The first pilot is invitation-only, synthetic first, limited by jurisdiction and case count, and requires a focused security review or penetration test plus a restore drill. | Owner + security + operations |
| A-16 | Claimant key custody | Registered-recipient setup cannot begin until an approved client and custody design can retain or recover the claimant private key without server recovery, browser persistence, implicit password-reset recovery, or unreviewed export. If no compliant web design is approved, key generation and release decryption require an approved native or hardware-backed client. | Owner + security + privacy |
| A-17 | Route-specific release material | Every claim binds exactly one release-material profile: registered-recipient sealed grant or V2 secret-wrapped MEK. State predicates, manifests, packages, invalidation, and vectors must identify and validate that profile without treating the two routes as interchangeable. | Owner + security |

## Trust Surfaces And Origins

| Surface | Allowed purpose | Forbidden behavior |
| --- | --- | --- |
| `sanduqkin.com/claim` | Static explanation and route selection | Forms, code entry, identity data, cookies, or persistence |
| `app.sanduqkin.com` | Future claimant authentication, cases, and local read-only viewer | Owner-vault routes, parent-domain cookies, privileged decisions |
| `vault.sanduqkin.com` | Owner recipient/grant management and cancellation | Claimant evidence or reviewer tooling |
| `api.sanduqkin.com` | Canonical authorization, transitions, outbox, and package coordination | Server-side vault decryption or accepting client authority fields |
| Private reviewer surface | Evidence review and independent decisions | Public access, claimant session reuse, bulk export, or direct vault access |
| Supabase private workflow schema | Durable state, ciphertext, safe audit metadata | Browser-wide grants, implicit table privileges, or public evidence URLs |

All cookies are host-only. Exact redirect, CORS, origin, CSP, and route allowlists are deployment gates. Reviewer administration should use a separate workforce identity boundary and must not share claimant authentication sessions.

## Roles And Capabilities

Legend: `Y` allowed after all preconditions, `N` forbidden, `S` server-mediated only.

| Capability | Owner | Claimant | Reviewer | Security/incident | Processor | Support |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nominate/revoke recipient | Y | N | N | N | N | N |
| Register claimant public key | N | Y | N | N | S validate | N |
| Finalize/replace sealed grant | Y, unlocked | N | N | N | N | N |
| Create claim draft | N | Y | N | N | S | N |
| Submit identity/evidence | N | Y | N | N | S | N |
| Cancel before retrieval | Y | N | N | S incident only | S enforce | N |
| Withdraw claim | N | Y | N | N | S enforce | N |
| View quarantined evidence | N | Own uploads/status only | Assigned case only | Incident scope only | Scan only | N |
| Record one review decision | N | N | Y, no conflict | N | S validate | N |
| Record second approval | N | N | Different reviewer | N | S validate | N |
| Advance a timer | N | N | N | N | S to reviewable state only | N |
| Build release package | N | N | N | N | S after recheck | N |
| Suspend retrieval | N | N | N | Y | S enforce | Escalate only |
| Retrieve/decrypt package | N | Y, own authorized claim | N | N | S authorize; client decrypts | N |
| Change state directly in a table | N | N | N | N | N | N |

The service role is not a business role. It may execute narrowly scoped processors but cannot bypass transition predicates, dual approval, cancellation, expiry, or audit requirements.

## Canonical State Machine

### Primary path

`draft -> identity_pending -> submitted -> owner_notified -> cooldown -> review_pending -> approved -> release_ready -> released -> closed`

### Holding and terminal states

- `on_hold`
- `manual_review`
- `cancelled_by_owner`
- `withdrawn_by_claimant`
- `rejected`
- `expired`
- `release_suspended`

### Transition matrix

| From | To | Actor | Required predicates | Invalidates |
| --- | --- | --- | --- | --- |
| none | `draft` | Claimant through API | Authenticated `aal2`; accepted policy version; supported route and jurisdiction | Nothing |
| `draft` | `identity_pending` | Claimant through API | Claimant owns case; intake capability enabled | Nothing |
| `identity_pending` | `submitted` | Processor | Identity/evidence policy satisfied; selected route profile valid; registered-recipient grant/key or V2 locator/proof/wrapped-MEK version unchanged | Prior incomplete attempts |
| `submitted` | `owner_notified` | Processor | Value-free notice transactionally enqueued; owner contact route available | Nothing |
| `owner_notified` | `cooldown` | Processor | Verified delivery under approved policy; server records deadline | Nothing |
| `cooldown` | `review_pending` | Timer processor | Server deadline expired; no cancellation, dispute, hold, grant/key change, or delivery failure | Nothing |
| `review_pending` | `approved` | Processor | Two current, independent allow decisions; no conflicts; all predicates rechecked | Nothing |
| `approved` | `release_ready` | Package processor | Immutable snapshot built; manifest validated; route-specific release material active and version-matched; kill switches off | Superseded package attempts |
| `release_ready` | `released` | Claimant through API | Fresh `aal2`; unexpired session; authorization recheck; first successful package retrieval | Unused retrieval tokens |
| `released` | `closed` | Processor | Package expired or claimant acknowledgement; retention actions scheduled | Active retrieval sessions |
| Any pre-release | `cancelled_by_owner` | Owner through API | Fresh owner session; owner-case binding | Decisions, deadline, package, sessions |
| Any pre-release | `withdrawn_by_claimant` | Claimant through API | Claimant-case binding | Decisions, deadline, package, sessions |
| Any nonterminal | `on_hold` | Processor/reviewer/security | Delivery failure, inconsistency, dispute, key/grant change, deletion, outage, or risk signal | Deadlines, decisions as policy requires, sessions |
| `on_hold` | `manual_review` | Authorized case lead | Hold reason is reviewable under approved policy | Nothing |
| `manual_review` | Earlier allowlisted state | Processor | Recorded disposition; all affected controls repeated | Stale decisions and deadlines |
| `review_pending` or `manual_review` | `rejected` | Authorized review result | Policy reason code and required review record | Packages and sessions |
| Eligible pre-release | `expired` | Processor | Policy deadline exceeded | Decisions, packages, sessions |
| `release_ready` or `released` | `release_suspended` | Security/processor | Incident switch, compromise, court/policy hold, or authorization failure | Future retrieval sessions |

No generic “set state” function is permitted. Each transition uses a dedicated database function or a single transition function with an allowlisted transition identifier, expected version, actor context derived server-side, idempotency key, safe reason code, and transactionally appended event/outbox records. Optimistic version checks prevent races.

## Registered-Recipient Protocol V1

This is the first implementation route after Slice 2 approval. The old `pre_authorized_kin` symmetric wrapping helper is not this protocol and must not be exposed as if it were.

### Cryptographic profile

- Recipient encryption key: X25519-compatible key pair generated locally with audited libsodium primitives.
- Grant envelope: libsodium sealed box to the registered recipient public key.
- Grant plaintext: canonical versioned structure containing the MEK and binding fields; it exists only inside the unlocked owner client before sealing and inside the authorized claimant client after opening.
- Key fingerprint: BLAKE2b-256 over the protocol label, key version, and public key; displayed in a short human-checkable form but compared in full by clients.
- Encoding: base64url without padding for binary fields; UTF-8 JSON using a specified canonical serializer before hashing or sealing.
- Domain label: `sanduqkin:claim:recipient-grant:v1`.

Sealed boxes do not authenticate an owner identity. Binding values inside the encrypted grant and the authenticated owner-side finalization event prevent cross-context use; the claimant must verify every binding after opening. A later signed-owner protocol would be a new version, not an in-place reinterpretation.

### Messages

1. `RecipientInvitationV1`
   - `invitation_id`, random single-use token hash, inviter-safe label, policy version, expiry, address-normalization version, and intended-recipient keyed address digest.
   - Notification contains only a value-free link token. The raw token is never stored and is consumed once.
2. `RecipientKeyRegistrationV1`
   - `recipient_id`, `key_id`, `key_version`, X25519 public key, fingerprint, creation time, and attested client/protocol version.
   - Requires fresh `aal2`. Private key material never leaves the client.
3. `RecipientGrantPlaintextV1` (sealed, never persisted in plaintext)
   - `protocol`, `grant_id`, `owner_id`, `recipient_id`, `recipient_key_id`, full public-key fingerprint, `issued_at`, random 128-bit grant nonce, and 32-byte MEK.
4. `RecipientGrantEnvelopeV1`
   - `protocol`, `grant_id`, `recipient_id`, `recipient_key_id`, sealed-box algorithm, ciphertext, created time, and revocation/version metadata.
5. `ReleaseManifestV1`
   - `protocol`, `claim_id`, `release_package_id`, route profile, owner/claimant bindings, release-material id and version, owner-cancellation version, asset snapshot boundary and count, ordered asset ciphertext digests, package creation/expiry, policy decision version, signature algorithm, and signing-key id.
   - The canonical manifest bytes and detached signature form a versioned envelope. Claimant clients trust only an allowlisted signing-key chain delivered independently of the package and reject unknown, revoked, or expired signing-key versions.

### Registration and grant flow

1. Owner nominates an address. The API normalizes it under a versioned rule, stores a keyed address digest and a separate hash of the random single-use invitation token, and sends a value-free notice. Acceptance requires the authenticated account to have the same verified normalized address. The landing exchange immediately consumes or replaces the URL token and returns a no-referrer, no-store response so it does not remain in later URLs, history entries, analytics, or downstream requests.
2. Recipient authenticates, enrolls MFA, accepts the current claimant policy, and generates the key pair locally.
3. The recipient registers only the public key. Replacement requires fresh `aal2`, invalidates pending invitations/grants as applicable, and creates an append-only key event.
4. The unlocked owner client fetches the accepted recipient public key and displays its fingerprint and replacement status.
5. After explicit owner confirmation, the client seals `RecipientGrantPlaintextV1` and uploads only `RecipientGrantEnvelopeV1`.
6. The server validates identifiers, key version, ciphertext bounds, uniqueness, and owner/recipient relationships without decrypting the grant.
7. Revocation or replacement is explicit and append-only. No claim may progress on a revoked, superseded, or mismatched grant.

### Private-key recovery boundary

The MVP baseline does not upload a claimant private key or a server-recoverable private-key package. A claimant key may be kept only in the client and custody design approved under A-16. The current browser policy prohibits persistence in local storage, session storage, IndexedDB, Cache Storage, and service-worker storage, so the registered-recipient slice cannot assume that a browser can retain the key. If no compliant browser custody design is approved, generation and use move to an approved native or hardware-backed client. Loss requires key replacement and owner re-finalization before a claim. Cross-device recovery or user-directed key export is a separate reviewed protocol; account password reset must never reconstruct a claimant key implicitly.

## V2 Offline Handover Protocol

V2 is a new format. It must not reuse V1 formatting, associated data, or database rows as if they were compatible.

### Human material

- Public locator: 128 random bits, Crockford Base32 encoded with a `SK2-L-` prefix and checksum. It may be submitted but still must not be logged or placed in URLs.
- Client-only secret: at least 160 random bits, Crockford Base32 encoded with a `SK2-S-` prefix and checksum. It is never submitted, logged, emailed, placed in a URL, or stored by Sanduqkin.
- The printed handover kit clearly separates “Locator” from “Secret” and warns that neither alone authorizes release.

Modulo-biased byte-to-alphabet mapping is forbidden. Generate uniformly random bytes and encode them directly. Formatting and checksum symbols do not count toward entropy.

### Derivation and proof profile

1. The owner client generates the locator, secret, random Argon2 salt, and parameters.
2. It derives a 32-byte root from the normalized secret using Argon2id in a worker.
3. It treats the root as a libsodium KDF master key and derives independent 32-byte subkeys with the fixed eight-byte context `SKCLMV2!`:
   - subkey id `1`: Ed25519 proof seed;
   - subkey id `2`: MEK wrap key.
4. The proof seed deterministically creates an Ed25519 proof key pair. The server stores only the proof public key.
5. The wrap key encrypts the MEK with XChaCha20-Poly1305. Associated data binds protocol version, locator digest, grant id, owner id, and creation timestamp.
6. The stored row contains a keyed locator digest/index, proof public key, KDF salt/parameters, wrapped-MEK ciphertext/nonce, version, expiry/revocation state, and safe timestamps. It contains no secret, root, proof private key, wrap key, or plaintext MEK.

Final KDF parameters are not approved by this design. They require browser-worker benchmarks on representative iOS, Android, desktop, and low-memory devices. Parameters may increase by version but may never be silently reduced for a claimant.

The stored locator index is a BLAKE2b-256 keyed digest under a versioned server-held index key. Key rotation retains bounded lookup support for active versions; raw locators and unkeyed locator hashes are not stored.

### Possession challenge

1. Client sends the locator in a POST body to the dedicated claim origin. TLS termination, proxy, API, WAF, and application logging must redact the body and locator-derived identifiers.
2. Server returns a constant-schema challenge containing a random 256-bit nonce, opaque challenge id, KDF profile, salt, proof context, and expiry. Unknown/revoked locators receive indistinguishable synthetic values and consume the same rate-limit budget.
3. Client derives the proof key locally and signs a canonical challenge containing protocol, challenge id, nonce, origin, expiry, and a hash of the locator.
4. Client submits the signature and opaque challenge id, never the secret or derived private seed.
5. Server verifies once, consumes the challenge atomically, and returns the same public response shape for invalid, expired, replayed, unknown, revoked, and mismatched attempts.
6. Successful possession creates only a possession assertion bound to the authenticated `aal2` claimant session. It does not create an approval or permit release.

Rate limits apply per IP/risk bucket, locator digest, account, device signal where lawful, and global circuit breaker. CAPTCHA or step-up risk controls occur before expensive repeated work. Response padding and bounded timing are tested statistically; the design does not promise perfectly identical network timing.

### V1 compatibility

- Existing V1 grants remain owner-controlled setup artifacts and cannot initiate a public claim.
- No API scans `emergency_key_grants`, and no endpoint accepts a complete V1 code.
- Owners may keep V1 active until they deliberately create and confirm a V2 kit.
- V2 creation uses a new secret and a new row. After confirmation, the owner client may revoke the selected V1 grant in a separate idempotent action.
- Interrupted conversion leaves V1 unchanged and marks the incomplete V2 row unusable/revoked.
- UI copy must say that V1 requires owner-confirmed regeneration before it can support the future offline route.
- Automatic conversion is impossible because Sanduqkin does not possess the V1 secret.

## Evidence Quarantine Contract

Evidence implementation remains blocked until the record-level policy in A-08 and A-11 is approved.

- Use a separate private bucket and non-public workflow schema.
- Object keys are randomized and case-bound; original filenames are not persisted in ordinary metadata or logs.
- Upload capability is short-lived, single-case, single-purpose, size/count/type constrained, and unavailable before `aal2` and policy acceptance.
- Validate declared type and file signature, enforce decompression/page limits, quarantine first, malware scan, and permit reviewer access only after a clean result.
- Claimant status projections reveal only safe processing states, never scanner output or internal reviewer notes.
- Downloads are short-lived and assigned-reviewer bound. Reviewer access is audited with safe metadata.
- Backups, restore, deletion, legal hold, breach response, and reviewer workstation rules require independent tests.

## Release Package Contract

The package processor never decrypts owner records, a registered-recipient grant, or a V2 wrapped MEK. Every claim and package carries exactly one route-specific release-material profile:

- `registered_recipient_v1` binds the accepted recipient, claimant key id/version, and `RecipientGrantEnvelopeV1`; the claimant client opens the sealed grant with the approved claimant private key.
- `offline_code_v2` binds the locator-record id/version, proof-key version, KDF profile, and V2 wrapped-MEK envelope; after fresh possession proof, the claimant client re-derives the wrap key from the client-only secret and opens the wrapped MEK locally.

The profiles are a closed discriminated union. A package, claim, decision, or retrieval session cannot switch profiles or substitute release material after submission. A route-specific key, grant, locator, KDF, proof-key, wrap-envelope, or protocol-version change invalidates prior decisions and packages and moves the case to `on_hold`.

1. In one authorized workflow transaction, freeze the approved claim version, grant/key version, owner cancellation version, and asset snapshot boundary.
2. Copy only the authorized encrypted asset envelopes and approved display metadata into an immutable package namespace.
3. Attach only the selected route profile's encrypted release material and a signed server manifest of ciphertext digests, route profile, release-material version, cancellation version, and bindings.
4. Recheck cancellation, grant/key validity, approvals, cooldown, kill switches, package expiry, and account state before issuing every retrieval session.
5. The claimant client verifies the signing-key chain and server manifest, opens the route-specific sealed grant or wrapped MEK locally, verifies all inner bindings, and decrypts records into a memory-only read-only viewer.
6. The viewer disables edits, exports by default, browser persistence, service-worker caching, and background retention. Any later local export is a separately approved feature.

## API And Database Rules

- JWT verification includes signature, issuer, audience, expiry, subject, session identity, and `aal2` for sensitive operations.
- Owner, claimant, case, role, assurance, jurisdiction, policy, deadline, approval, and state values are derived or verified server-side.
- Mutations require an idempotency key scoped to actor, operation, and object. The stored response digest prevents semantic reuse.
- Transitions use serializable or explicitly locked transactions, expected row versions, database constraints, append-only events, and transactional outbox insertion.
- Scheduled processors can enqueue notice work, expire capabilities, or advance an expired cooldown to `review_pending`; they cannot approve or release.
- Client-exposed schemas have explicit grants and deny-by-default RLS. Claim workflow tables should remain private behind narrow functions or the API.
- Service credentials remain only in protected processors. Next.js page code has no release authority.
- Error bodies use stable public reason classes and correlation ids. Internal reasons and existence signals remain value-free and restricted.

### Legacy emergency-access schema boundary

The existing public `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests` tables were created for the owner-only Phase 1 foundation. They are not an approved claimant workflow schema. In particular, their current state values, authenticated grants, and owner-oriented RLS do not implement this state machine, reviewer separation, `aal2`, evidence isolation, or release packaging.

- Keep installed-client owner setup behavior backward compatible.
- Do not expose those tables to a claimant or reviewer, add claimant policies to them, or treat `emergency_release_requests` as an approved live claim table.
- Slice 3 must decide whether registered-recipient setup uses additive owner-facing columns/tables or a private replacement projection, with migration catalog and hostile RLS tests.
- Future claimant workflow state belongs in a private schema with narrow API/database functions. Legacy `released` status values do not authorize a claimant release.
- Any later legacy cleanup requires installed-client compatibility evidence and an additive migration; it is not part of Slice 2.

## Notifications

- Messages are value-free: they do not include owner vault fields, evidence, emergency secrets, code locators, relationship assertions, release contents, or coercive countdown detail.
- Outbox jobs are unique, retry bounded, and record provider message identifiers only when approved.
- Delivery failure does not count as owner notice and moves the case to hold under A-04.
- Links contain single-purpose random tokens, never claim ids, email addresses, locators, secrets, or release material.
- Support cannot bypass delivery, identity, cooldown, approval, or retrieval controls.

## Threat Model And Required Tests

| Threat | Required control | Required evidence before implementation exit |
| --- | --- | --- |
| Cross-account object access | API binding, private schema, RLS/Storage RLS | Owner A cannot read/write claimant B, claim C, evidence D, or package E across every operation |
| Invitation theft/replay | Hashed token, short expiry, single consumption, verified normalized-address binding, keyed address digest, and immediate URL-token exchange | Replay, parallel consume, wrong or unverified account, normalization variants, expiry, enumeration, referrer/history, proxy/log, and downstream-request tests |
| Locator enumeration | High entropy, keyed digest, constant schema, layered limits | Known/unknown/revoked statistical response and rate-limit tests |
| Secret guessing | >=160-bit secret, Argon2id, proof signatures, attempt controls | Offline cost analysis, worker benchmarks, invalid proof/replay/property tests |
| Full-secret disclosure | Split format, body redaction, no URL use | Proxy/API/log/analytics/crash-artifact scans and hostile deep-link tests |
| Reviewer fraud | Conflict rules and independent approvals | Self-approval, duplicate reviewer, role change, stale decision, and collusion alert tests |
| Race at cooldown/cancel | Locked/versioned transition and recheck | Cancel/package/retrieve concurrency and property-based state-machine tests |
| Key/grant replacement | Version binding and invalidation | Replacement during each active state, stale grant, revoked grant, and deleted account tests |
| Malicious evidence | Quarantine, signature/type limits, scan gate | MIME confusion, polyglot, archive bomb, oversized, page-count, filename, and unscanned-access tests |
| Stolen session | Fresh session, `aal2`, bounded token, rechecks | AAL downgrade, refresh failure, displacement, CSRF, clickjacking, and open-redirect tests |
| Browser leakage | Memory-only secrets, CSP, no-store, cleanup | XSS probes, storage/cache inspection, worker cleanup, background/timeout/fatal-error tests |
| Notification leakage/failure | Value-free templates and outbox | Snapshot templates, provider payload inspection, retries, duplicates, and permanent failure hold |
| Processor partial failure | Transaction, idempotency, outbox | Crash at every write boundary, retry, duplicate job, and audit/outbox reconciliation tests |
| Backup/region incident | Restore plan and drills | Database plus Storage restore, missing object, stale snapshot, and regional outage exercise |
| Insider/service-role abuse | Narrow processors, immutable events, alerts | Forbidden bulk access, direct transition, approval bypass, and audit tamper attempts |
| Package substitution | Signed digest manifest and inner grant bindings | Asset removal/addition/reorder, manifest replay, cross-claim swap, and expired signature tests |
| Route-profile confusion | Closed release-material union and version binding | Registered-recipient/V2 substitution, missing discriminator, stale material, changed KDF/key version, and cross-route package tests |
| Claimant-key loss or leakage | Approved custody client, no server recovery, explicit replacement | Browser persistence scans, lost-device/key, password-reset, cross-device, export, replacement, and owner re-finalization tests |

## Test-Vector Plan

Before Slice 3 code is accepted, commit a versioned, synthetic vector set under `packages/shared-types/test-vectors/claim/`. No vector may contain a production identifier or secret.

### `recipient-grant-v1.json`

Include:

- fixed synthetic owner, recipient, grant, and key UUIDs;
- fixed recipient key seed and expected X25519 public/private keys for test use only;
- fixed MEK and grant nonce;
- canonical `RecipientGrantPlaintextV1` bytes and digest;
- one captured sealed-box ciphertext and the expected opened plaintext;
- negative cases for wrong private key, changed recipient/key/grant binding, truncated ciphertext, and unsupported version.

Because sealed-box encryption is randomized, tests compare successful opening and binding validation, not newly generated ciphertext equality.

### `offline-code-v2.json`

Include:

- fixed synthetic locator bytes, secret bytes, formatting, and checksums;
- fixed salt and approved Argon2id parameter version;
- expected root, proof seed, Ed25519 public/private test keys, wrap key, locator digest, and associated-data bytes;
- fixed challenge canonical bytes and expected signature;
- fixed MEK, nonce, ciphertext, and expected unwrap result;
- negative cases for changed locator, challenge origin, expiry, grant id, owner id, signature, secret, ciphertext, and protocol version.

### `claim-state-v1.json`

Include every allowed and denied transition with previous state, requested transition, actor role, assurance level, clock, version, policy predicates, expected result class, and invalidations. Add generated property tests ensuring no path reaches `release_ready` or `released` without every independent control.

### `release-package-v1.json`

Include one registered-recipient and one V2 package with canonical manifest bytes, signing-key id, detached signature, route discriminator, release-material version, cancellation version, ordered ciphertext digests, and expected client validation result. Negative cases cover missing or changed discriminators, cross-route material substitution, stale keys/KDF profiles, cancellation-version changes, manifest reordering, unknown signing keys, expired signatures, and inner/outer binding mismatches.

### Vector governance

- Generate vectors with a reviewed script, never by hand-editing derived values.
- Verify vectors in mobile, web, API, and an independent reference runner where practical.
- Any primitive, encoding, canonicalization, KDF parameter, associated-data, or envelope change creates a new version and retains backward tests.
- Production code must reject unknown versions closed and return a generic public error.

## Kill Switches

Kill switches are deny-by-default server-side controls stored in durable reviewed configuration. Environment-variable-only switches are insufficient for incident response unless their deployment and audit behavior is proven.

| Switch | Effect |
| --- | --- |
| `claim_intake_enabled` | Allows new drafts/submission only for allowlisted routes and jurisdictions |
| `recipient_invites_enabled` | Allows invitation creation/acceptance |
| `offline_v2_enabled` | Allows V2 challenge and possession assertions |
| `evidence_upload_enabled` | Allows new short-lived upload capabilities |
| `review_transitions_enabled` | Allows new reviewer decisions and progression |
| `package_build_enabled` | Allows creation of new release packages |
| `package_retrieval_enabled` | Allows new/reused retrieval sessions |
| `claim_global_hold` | Overrides all progression and retrieval, preserving owner cancellation/claimant withdrawal and incident access |

Every privileged operation checks the relevant switch at execution, not only in the UI. Changes require an authorized actor, reason, expiry/review time, append-only event, monitoring alert, and two-person control for re-enabling release-related switches.

## Rollback And Recovery

- Database migrations are additive. A rollback disables capabilities and application paths; it does not drop case, audit, evidence, or package data.
- A faulty deploy first activates `claim_global_hold`, disables package build/retrieval, and drains or quarantines processors before code rollback.
- In-flight jobs are idempotently resumable. Unknown completion state is reconciled from database events and object manifests, never guessed from logs.
- Package corruption or manifest mismatch invalidates the package and returns the case to `on_hold`; it never rebuilds after approval without a new package version and authorization recheck.
- Restore procedures reconcile database rows, evidence objects, packages, outbox jobs, and audit events. Orphaned or missing objects cause holds.
- Key or protocol compromise revokes the affected protocol/key versions, suspends retrieval, preserves evidence, and follows the approved incident and claimant-notification policy.
- Rollback testing must prove installed owner clients remain safe and that V1 grants are neither exposed nor silently destroyed.

## Slice 2 Exit Gate

Slice 2 is ready for approval review when:

- every A-series decision has an owner and an explicit approve/change/reject result;
- qualified legal/privacy review resolves jurisdiction, authority, evidence, retention, dispute, operator/controller, and incident responsibilities;
- security review accepts the registered-recipient and V2 primitive choices, binding rules, threat model, kill switches, and vector plan;
- security and privacy review approve A-16 claimant-key custody and A-17 route-specific release-material behavior, with no assumption that the browser may persist the claimant private key;
- operations identifies reviewer qualifications, separation of duties, case limits, support boundaries, monitoring, backup, and restore owners;
- no critical threat remains unresolved; and
- the handoffs record the approved versions and exact next bounded slice.

Until then, the only allowed claimant surface is the inactive informational foundation from Slice 1.

## Security References

- [Libsodium sealed boxes](https://doc.libsodium.org/public-key_cryptography/sealed_boxes) — recipient-only decryption, ephemeral sender keys, and the lack of sender authentication.
- [Libsodium public-key signatures](https://doc.libsodium.org/public-key_cryptography/public-key_signatures) — deterministic seed key pairs and detached Ed25519 verification.
- [Libsodium password hashing](https://doc.libsodium.org/password_hashing/default_phf) — Argon2id and the requirement to retain algorithm and parameter versions.
- [Libsodium key derivation](https://doc.libsodium.org/key_derivation) — independently derived subkeys and fixed domain-separation contexts.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — reauthentication, MFA, throttling, and server-side session protections for sensitive actions.

## Approval Record

| Area | Approver | Decision | Date | Notes/version |
| --- | --- | --- | --- | --- |
| Product/owner | Project owner, confirmed in Codex task | Approved | 2026-07-20 | Approved the two-route claimant flow and authorized hard-disabled structure/placeholders. Evidence must use private quarantine with value-free admin email notification; vault release remains claimant-local decryption. |
| Security/cryptography | Internal owner/AI design review | Direction accepted; independent assurance pending | 2026-07-20 | The project owner accepts the proposed security direction. AI-assisted review is not independent security assurance or a penetration test. |
| Legal/release authority | Project owner | Product direction accepted; qualified counsel pending | 2026-07-20 | The project currently has no separate legal reviewer. This acceptance does not establish legal validity in any jurisdiction. |
| Privacy/evidence/retention | Project owner | Product direction accepted; qualified privacy review pending | 2026-07-20 | The owner accepts private quarantine and data-minimization direction. Collection of real claimant PII remains blocked. |
| Operations/reviewer model | Project owner, current sole operator | Approved for protected scaffolding | 2026-07-20 | There is currently no second human reviewer; dual independent approval and live release therefore cannot operate. |

The project owner confirmed on 2026-07-20 that the project currently consists only of the owner and the AI development partner. This approval permits continued local/protected scaffolding with dedicated identities and synthetic data. It does not satisfy independent security testing, qualified legal/privacy review, reviewer separation, or the two-human release rule. Real claimant data, evidence collection, external claimant access, approval, and release remain blocked until those capabilities exist.
