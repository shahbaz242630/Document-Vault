# Claimant Slice 1B Native Bootstrap And First-Key Handoff

Date: 2026-08-04 (Asia/Dubai)

## Decision And Scope

The next claimant engineering slice is the registered-recipient native first-key handoff. Hosted Supabase MFA client work is parked while the project remains on the Free plan. Existing API/database fresh-AAL2 enforcement remains mandatory and unchanged; engineering tests may use synthetic verified AAL2 sessions, but no external claimant flow may activate until the approved paid plan, hosted MFA enrollment/challenge/recovery, and production-shaped session tests pass.

Slice 1B must not call the existing invitation-acceptance mutation with an unproven public key. It first adds the versioned native enrollment and possession-proof contracts needed to bind an eligible authenticated claimant, pending invitation, non-exportable native key, and accepted invitation transactionally.

## Trust Boundaries

- The public `/claim/**` pages remain informational and receive no invitation, credential, key, or evidence data.
- The claimant web application never generates, imports, stores, or uses the claimant private key. Hosted web sign-in/MFA remains parked.
- The existing native Sanduqkin app hosts an isolated claimant mode. The first supported implementation target is iOS Secure Enclave P-256 key agreement with passcode-required, device-only storage and transaction-bound user presence.
- Android enrollment remains ineligible until transaction-bound P-256 key agreement and the required hardware-security baseline are available and independently approved. There is no software-key or timed-authentication downgrade.
- The API derives the authenticated user, verified address binding, eligibility, invitation ownership/binding, assurance, and session context. Clients do not submit actor IDs, roles, verified-address digests, eligibility, or acceptance authority.
- The database/API may hold a bounded server ephemeral key or protected equivalent only for possession-proof verification. They never receive or recover the claimant private key or the derived shared secret as application output.

## Registered-Recipient Bootstrap Sequence

1. The owner issues a death-only registered-recipient invitation to a normalized-address digest. Delivery contains value-free copy and a distinct single-purpose random delivery token; the stable internal invitation reference is never transported. Neither value is authorization.
2. The claimant creates or signs into the same verified Supabase account in an approved protected client. Production account creation, email verification, MFA enrollment/challenge/recovery, enumeration resistance, and abuse controls remain a paid-plan pre-live gate.
3. The API derives and normalizes the verified authentication address server-side, computes the versioned digest, and matches it to the pending invitation. A client-supplied address or digest is never authoritative.
4. The API verifies claimant-portal eligibility, a context-bound active session, fresh AAL2, invitation status/version/expiry, and non-self acceptance before issuing a single-use native-enrollment challenge.
5. The eligible iOS claimant mode verifies Secure Enclave/passcode/user-presence capability, creates a non-exportable P-256 key under a claimant-only alias, and exports only the canonical ANSI X9.63 uncompressed public key plus value-free capability metadata.
6. The API binds the challenge to the claimant, invitation, proposed key fingerprint, non-authoritative device-context digest, exact API audience, policy version, expiry, and one server ephemeral P-256 public key. Production acceptance also requires a verified Apple App Attest assertion, or independently approved equivalent, bound to the challenge and proposed claimant key; self-asserted capability metadata is insufficient.
7. After transaction-bound user presence, the native client performs Secure Enclave ECDH, derives a proof key using the approved versioned HKDF labels/context, returns only the possession MAC and public bindings, and clears derived material.
8. The API verifies and atomically consumes the challenge. Only then may the database create/bind the claimant identity, public key, case, audit/outbox records, and invitation acceptance. Replay, changed input, stale version, cross-account, cross-invitation, cross-key, and partial failure fail closed.
9. The native app records only its platform key reference/alias and safe public fingerprint. Browser storage receives no invitation secret, key, shared secret, proof key, evidence, or case material.

## First Bounded Code Increment

Implement runtime-disconnected, versioned shared contracts and validation for:

- native enrollment capability metadata;
- the server-derived bootstrap binding versus client-allowed request fields;
- challenge issuance inputs and public response;
- native possession-proof response;
- prohibited sensitive-field rejection; and
- deterministic synthetic fixtures/tests consumed by shared, mobile, web, and API code without adding a live route.

The increment may add an isolated mobile coordinator interface that accepts public-only native results. It must keep its runtime capability fixed to `false`, must not add a production key alias, and must not call Supabase or the claimant API.

## Non-Goals

- No hosted MFA UI, public signup, recovery, or Auth configuration change.
- No live native production key generation or invitation acceptance.
- No challenge database table, server ephemeral private-key custody, endpoint, email delivery, deep link, or push notification yet.
- No client-supplied verified address digest or actor/role identifier.
- No browser key operation, software key fallback, Android enrollment, owner grant sealing, evidence, review, release, or deployment.

## Exit Gate For Contract Increment

- All contracts are strict, versioned, and reject private keys, shared secrets, proof keys, raw addresses, client actor IDs/roles, and client-asserted eligibility/acceptance.
- Canonical public key, fingerprint, challenge, expiry, binding, and proof fields have exact bounds and deterministic fixtures.
- Cross-consumer tests prove mobile/web/API interpret the same fixture without network or persistence.
- Claimant capability flags and the native custody probe remain false.
- Full typecheck, lint, security, secret, vector/custody isolation, and relevant regression suites pass.

## Gates Before Runtime Challenge Work

- Approve the server ephemeral-key custody/expiry design and cryptographic labels with an independent reviewer.
- Record physical iOS Secure Enclave evidence and an Apple native compile for the production-shaped key APIs.
- Approve the distinct delivery-token expiry/exchange and raw-address retention rules; preserve local-part case and lowercase only the DNS domain under `email-ascii-v1`.
- Approve Apple App Attest binding or an independently reviewed equivalent before trusting native capability metadata.
- Upgrade/approve the hosted Supabase plan and complete MFA enrollment, challenge, recovery, displacement, and abuse testing before any external claimant access.
