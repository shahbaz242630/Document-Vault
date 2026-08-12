# Native Enrollment Independent Review Packet

Date prepared: 2026-08-04 (Asia/Dubai)

Status: verified private ZIP supplied to the owner for qualified independent review; no independent decision has been received.

## Review Objective

Determine whether the frozen runtime-disconnected registered-recipient first-key design is safe to advance into separately reviewed native App Attest, server verification/persistence, and atomic invitation-acceptance implementation slices.

The review covers:

- iOS Secure Enclave P-256 ECDH possession proof;
- HKDF-SHA-256/HMAC-SHA-256 transcript and canonical encodings;
- server-ephemeral AES-256-GCM custody and lifecycle design;
- Apple App Attest registration/assertion binding;
- invitation-address normalization and keyed indexing;
- separate delivery-token privacy, recovery, enumeration, logging, retention, and abuse boundaries.

It does not approve external claimant access, production data, hosted MFA, notification delivery, evidence, review operations, release, deployment, or the future runtime implementation.

## Independence Requirement

The decision must come from a qualified person who did not author the reviewed implementation and who discloses employment, contractual, financial, or personal conflicts. Codex and Shahbaz Malik may answer questions and remediate findings but cannot label their own assessment independent.

Recommended coverage may be supplied by multiple reviewers:

1. applied cryptography/protocol reviewer;
2. Apple platform/App Attest and server-verification reviewer;
3. privacy/application-security reviewer for invitation identity, delivery, retention, enumeration, and abuse.

## Frozen Inputs

Use `docs/verification/2026-08-04-native-enrollment-independent-review-manifest.md` as the authoritative file/hash manifest.

- Slice 1B aggregate: `4abdfb3230f96ada853f3ae096c28e8efc282cf5fbadf99e41d081a6780d3100`.
- Slice 1C aggregate: `a7bf764d6e4d1cc44175fadde533d73237e198b6e6680b8915b2b833306515cf`.

The working tree is not an immutable published commit. The owner chose a private ZIP preserving repository paths; its SHA-256 is `affd99bc05bd969045079ec9d0738ce0702e7dd7fa9f7c559c89bd828ba1ea58`. If the received archive or extracted manifested bytes differ from the recorded hashes, the reviewer must stop and request a regenerated snapshot.

## Required Cryptographic Review

The reviewer must independently determine and record:

- whether the P-256 ECDH construction and 65-byte ANSI X9.63 point format are appropriate;
- whether full curve/point validation, failure handling, all-zero rejection, and canonical Base64URL requirements are sufficient;
- whether public-key fingerprint, HKDF-info, and HMAC-input domain separation is unambiguous;
- whether the canonical challenge binds every required identity, key, invitation, policy, session/context, audience, freshness, random, and ephemeral value;
- whether raw ECDH output, 32-byte salt, transcript digest, HKDF-SHA-256 output length, and HMAC-SHA-256 key confirmation are correctly used;
- whether one-sided key confirmation is sufficient for this enrollment transition;
- whether constant-time verification, replay/concurrency rules, erasure limits, error shaping, and rate limiting are adequate;
- whether AES-256-GCM wrapping, 96-bit nonce uniqueness, 128-bit tag, associated data, key separation/rotation/usage limits, crash recovery, sweeper races, and destruction are sufficiently specified;
- whether any downgrade, unknown-key-share, cross-protocol, reflection, substitution, oracle, or state-confusion path remains.

The reviewer must reproduce the deterministic vector and RFC 5869 reference independently.

## Required Apple Native/App Attest Review

The reviewer must independently determine and record:

- whether App Attest plus the separate Secure Enclave possession proof establishes the intended app/key binding without overstating compromised-device resistance;
- whether one App Attest key per user/device and cross-user/environment reuse rejection are correct;
- whether registration `clientDataHash` and assertion client data bind the correct app, claimant, session, native challenge, claimant key/fingerprint, invitation, audience, freshness, and nonce values;
- whether the server checklist fully covers Apple certificate-chain/root, nonce, credential ID/public key, RP ID, counter, AAGUID environment, validation category, bundle version, extensions, receipt, and assertion-signature validation;
- whether TestFlight/App Store production-environment behavior and development separation are correct;
- whether counter locking/increment, replay, concurrency, reinstall/key loss, account switch, unsupported service, Apple outage, receipt refresh, and gradual rollout fail safely;
- whether key identifiers, receipts, counters, public keys, assertions, and fraud metrics receive appropriate storage, access, retention, telemetry, and incident handling;
- whether the no-fallback V1 policy is justified and correctly represented.

Primary Apple references:

- `https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity`
- `https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server`
- `https://developer.apple.com/documentation/devicecheck/attestation-object-validation-guide`
- `https://developer.apple.com/documentation/devicecheck/preparing-to-use-the-app-attest-service`

## Required Invitation And Privacy Review

The reviewer must independently determine and record:

- whether exact-case ASCII dot-atom local-parts and domain-only lowercasing are appropriate for V1;
- whether unsupported quoted/internationalized addresses fail safely without mailbox merging;
- whether HMAC-SHA-256 keyed indexing, domain separation, constant-time comparison, key rotation, and reissue behavior prevent enumerable raw digests and ambiguous binding;
- whether the stable UUIDv4 invitation reference remains strictly internal;
- whether a separate 256-bit single-purpose delivery token, keyed server digest, no-store POST exchange, constant-schema responses, and layered limits prevent useful enumeration and link leakage;
- what exact delivery-token lifetime is approved;
- what exact raw-address notification/provider retention and deletion policy is approved;
- whether address change/recovery, forwarding, provider normalization, self-invitation, cross-account replay, support access, telemetry, referrer/history, proxy/WAF logs, and incident response are adequate.

Primary email standards to consider include RFC 5321/5322 and RFC 6530; local-part case must not be silently folded by application policy without explicit justification.

## Required Finding Format

Each finding must include:

- stable identifier;
- severity: `P0 critical`, `P1 high`, `P2 medium`, or `P3 low`;
- affected aggregate/file/line or exact design section;
- attack or failure scenario;
- preconditions and impact;
- required remediation or explicit risk decision;
- whether it blocks native adapter work, server verifier work, live challenge work, external access, or all of them;
- evidence needed to close it.

Open `P0` or `P1` findings block the applicable runtime slice unless the independent reviewer explicitly accepts a bounded documented condition and the owner records the residual risk. Product-owner acceptance alone cannot convert a cryptographic/native/privacy defect into specialist approval.

## Decision Template

Reviewer name:

Organization/role and relevant qualifications:

Relationship to Sanduqkin/Shahbaz Malik and disclosed conflicts:

Review date and timezone:

Reviewed Slice 1B aggregate:

Reviewed Slice 1C aggregate:

Reviewed documentation revisions or hashes:

Independent reproduction environment and commands:

Independent vector reproduction result:

Findings attached: yes/no; identifiers:

Decision for native App Attest adapter slice: `APPROVED` / `APPROVED WITH CONDITIONS` / `CHANGES REQUIRED` / `REJECTED`.

Decision for server verifier/persistence slice: `APPROVED` / `APPROVED WITH CONDITIONS` / `CHANGES REQUIRED` / `REJECTED`.

Decision for live challenge and atomic invitation acceptance: `APPROVED` / `APPROVED WITH CONDITIONS` / `CHANGES REQUIRED` / `REJECTED`.

Explicitly unapproved scopes:

Conditions, residual risks, evidence required, and expiry/re-review trigger:

Reviewer signature or verifiable approval record:

## Current Stop Gate

No independent decision exists yet. Do not add DeviceCheck runtime code, App Attest entitlements, Apple credentials/calls, verifier persistence, a challenge endpoint, or invitation acceptance under this packet. The paid-plan hosted MFA and separate delivery-retention decisions also remain open.
