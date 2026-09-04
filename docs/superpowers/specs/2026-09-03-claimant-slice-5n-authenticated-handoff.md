# Slice 5N — authenticated possession-to-case handoff

Prerequisite satisfied by `f3120f4`: merged PR 68 and clean 5L/5M baseline.

An anonymously verified possession result is not bound to a claimant. Therefore
neither its public challenge ID nor its original signature authorizes case creation.
After authentication, issue a new two-minute, server-stored signing transcript
bound to the exact claimant, active AAL2 portal session/version, source possession,
server-selected draft case ID, expiry, nonce, and a distinct handoff domain label.
The holder signs these exact opaque bytes with the same possession key. Original
possession-proof signatures are invalid for this domain. No secret/private key
enters the server. Production client/native signing is not wired in this slice.

The disabled, unmounted controller derives identity/session from a verified bearer,
requires fresh non-recovery AAL2, validates exact origins and bounded strict input,
and exposes no client-selected case, policy, user, or session authority. Completion
loads the stored transcript for that account/session, verifies Ed25519, and submits
only transcript/signature digests to a service-only security-invoker transaction.
The transaction revalidates eligibility/session/version/freshness and locator/proof
state under the same lock order as 5M, atomically calls 5M, and stores one result.
An identical completion key/signature may replay only inside the original expiry
and while the same session remains active. Changed retries fail closed. A unique
source-possession/account/session tuple bounds handoff creation; an account rate
budget bounds additional issuance. Nothing advances identity, intake, review, or release.

Acceptance includes real crypto and PostgreSQL through the injected HTTP controller;
public-ID-only and original-proof replay rejection; cross-account/session, expiry,
revocation, stale/recovery AAL2, malformed proof/input/output, changed retries, exact
replay, and concurrent one-case consumption; rollback and direct client-role denial;
plus full regression/typecheck/lint/isolation/security verification.

All runtime approvals remain literal false. No production importer, hosted change,
deployment, native/EAS build, real data, push/publication, or subagent is authorized.
