# Claimant Slice 1B Possession-Proof And Invitation Review Pack

Date: 2026-08-04 (Asia/Dubai)

Status: runtime-disconnected engineering contract; disposable-probe physical-iOS evidence passed. Independent cryptographic, native-attestation, and invitation/privacy approval remain required before live implementation.

## Scope And Non-Authorization

This pack freezes the reviewable V1 transcript, deterministic synthetic vector, invitation bootstrap rules, and server-ephemeral lifecycle. It adds no endpoint, database table, Supabase change, native production key alias, delivery, deep link, or invitation acceptance. Hosted claimant MFA remains parked on the Free plan; fresh-AAL2 enforcement remains mandatory and is not replaced by key possession.

## Exact V1 Cryptographic Profile

- Protocol: `sanduqkin:claim:native-enrollment:v1`.
- Claimant and server-ephemeral keys: P-256 ECDH.
- Public-key representation: the 65-byte ANSI X9.63 uncompressed point (`0x04 || X || Y`), encoded as unpadded Base64URL. Compressed, padded, standard-Base64, JWK, PEM, hybrid, infinity, off-curve, and non-P-256 inputs fail closed. Runtime code must perform full platform/library point validation, not only string-shape validation.
- Public-key fingerprint: `SHA-256(UTF8("sanduqkin:claim:native-enrollment:public-key:v1") || 0x00 || public_key_bytes)`, encoded as unpadded Base64URL.
- The challenge request carries the public key but no fingerprint. The server decodes only canonical Base64URL, validates the full P-256 point, and computes the authoritative fingerprint; client-supplied fingerprint fields are rejected.
- Canonical challenge: the shared canonical JSON algorithm, with lexicographically sorted keys, UTF-8 encoding, safe integers only, and the exact strict field set in `NativeEnrollmentChallengeV1`. Missing, additional, or differently typed fields fail closed.
- ECDH input key material: the raw 32-byte P-256 ECDH result. An all-zero or failed result is rejected.
- HKDF salt: the decoded 32-byte random `kdf_salt` generated independently for each challenge.
- HKDF info: `UTF8("sanduqkin:claim:native-enrollment:proof-key:v1") || 0x00 || SHA-256(canonical_challenge)`.
- Proof key: RFC 5869 HKDF-SHA-256 over the ECDH result, producing exactly 32 bytes.
- MAC input: `UTF8("sanduqkin:claim:native-enrollment:proof-mac:v1") || 0x00 || canonical_challenge`.
- Possession proof: HMAC-SHA-256 under the proof key, encoded as unpadded Base64URL and compared in constant time.
- Client and server erase the ECDH result and proof key as soon as the transaction permits. They never persist, log, return, analyze, or export either value.

The deterministic reference is `packages/shared-types/test-vectors/claim/native-enrollment-proof-v1.json`. Its private scalars are synthetic test material only and must never be imported into Secure Enclave or any runtime custody path.

## Bound Challenge Fields

The MAC binds the protocol, challenge ID, server-derived claimant ID, claimant key ID/version, public-key fingerprint, device-binding digest, server-derived eligibility version, opaque invitation reference/version, accepted policy pack ID/version, exact HTTPS API audience, issue time, expiry time, random nonce, independent KDF salt, and server-ephemeral public key. The public key itself is bound through its domain-separated fingerprint and the ECDH operation. For a native client, `origin` is the server-derived canonical API audience, not a client-supplied browser `Origin` header. The device-binding digest is correlation/context only and is never accepted as proof of hardware custody or app integrity.

The response repeats only the protocol, challenge ID, claimant ID, claimant key ID/version, invitation reference, public-key fingerprint, device-binding digest, and MAC. Every repeated field must exactly match the immutable challenge row. A repeated field never overrides server state.

## Invitation Bootstrap V1

1. The owner submits the intended recipient email to the authenticated API over TLS. The browser must not submit an authoritative digest. The address is claimant-subsystem PII, never claim evidence or audit content.
2. `email-ascii-v1` normalization is deliberately narrow: trim leading/trailing ASCII space and horizontal tab; require a maximum 254-byte ASCII dot-atom address with a maximum 64-byte local-part and exactly one `@`; reject empty parts, comments, quoted local parts, control characters, consecutive dots, or leading/trailing dots; preserve the local-part byte-for-byte because it is case-sensitive; lowercase only the ASCII DNS domain and validate each domain label. Do not apply provider-specific dot removal, plus-tag removal, aliasing, mailbox equivalence, or local-part case folding. Internationalized addresses require a future version and migration. If the identity provider changes local-part case, matching fails safely and the invitation must be reissued against the exact verified address rather than silently merging mailboxes.
3. The server computes `HMAC-SHA-256(address_index_key_v1, UTF8("sanduqkin:claim:invitation-address:v1") || 0x00 || UTF8(normalized_address))` and stores only the 32-byte digest plus key/normalization version in invitation state. Raw SHA-256 is prohibited because email addresses are enumerable. The raw address may exist only in the bounded notification handoff and provider required records under an approved retention policy; it is excluded from application logs, events, analytics, URLs, and claim tables.
4. `address_index_key_v1` is held in a KMS/secret-manager boundary separate from claimant tables. Rotation revokes and reissues pending invitations under the retired version because the raw address is deliberately unavailable for silent reindexing. Exact rules are recorded in `docs/verification/2026-08-12-native-enrollment-review-closure.md`.

The server sends the canonical challenge as opaque unpadded Base64URL bytes. Native
clients MAC exactly the decoded bytes received and never recreate the byte sequence by
serializing the parsed challenge. Canonical JSON remains only a server construction and
conformance detail and is included in the frozen review boundary.
4. The invitation reference is an internal random UUIDv4 with 122 random bits. It is a locator, not authorization, and is never transported in email, URLs, deep links, referrers, analytics, or client logs. Delivery uses a distinct single-purpose 256-bit random token whose server record contains only a keyed digest, expiry, purpose, and consumption state. An approved universal link may carry that delivery token only; the protected client immediately exchanges it in a no-store POST, removes it from navigation/history state, and receives no stable internal invitation identifier until authenticated address, eligibility, assurance, and context checks pass. Known, unknown, expired, and consumed tokens use the same response schema and rate-limit budget. Exact delivery-token expiry and provider/raw-address retention require privacy approval before implementation.
5. The authenticated API obtains the provider-verified email server-side, applies the same versioned normalization and keyed digest, and compares it to the pending invitation in constant time. Client address, digest, claimant ID, role, eligibility, acceptance, and assurance assertions are ignored/rejected.
6. Before challenge issuance, the API revalidates verified email, active claimant-portal eligibility, exact protected origin/client context, fresh AAL2, invitation pending state/version/expiry, policy version, and non-self acceptance. Account recovery or address change invalidates outstanding challenges and requires a new binding decision.
7. A successful proof does not itself accept the invitation. Acceptance occurs only through the atomic server-owned transition below.

Client capability metadata is not hardware attestation. A production enrollment adapter must also require a server-verified Apple App Attest attestation/assertion, or an independently approved equivalent, bound to the one-time server challenge, exact app identity/environment, claimant public-key fingerprint, and native client context. Assertion counters and app/environment bindings fail closed. No self-asserted `secure_enclave` field or device-binding digest may satisfy this gate.

The existing Phase 1 mutation that accepts a client-supplied recipient address digest is not production-sufficient. It must be replaced or wrapped by this server-derived normalization/keyed-index flow before a live Slice 1B route exists.

## Server-Ephemeral And Atomicity Rules

- Create a fresh P-256 ephemeral key and independent 32-byte nonce and KDF salt per challenge. No reuse is permitted.
- Challenge TTL is exactly 300 seconds in V1. The server uses its trusted clock and rejects not-yet-valid, expired, cancelled, failed-terminal, or consumed challenges.
- Persist the ephemeral private scalar only as AES-256-GCM ciphertext under a versioned, separately controlled server wrapping key. Generate a fresh 96-bit nonce, use a 128-bit tag, and enforce nonce uniqueness per wrapping-key version. Canonical associated data binds the protocol, challenge ID, immutable challenge digest/version, expiry, and wrapping-key version. Persist the nonce, tag, public key, immutable challenge digest/version, wrapping-key version, creation/expiry, and state. Never persist plaintext or place the wrapping key in the same row/configuration boundary. Wrapping-key access, rotation, maximum usage, and destruction require an approved key-management runbook.
- Challenge creation and encrypted-private-key persistence are one transaction. Failure leaves no usable challenge.
- The service decrypts the ephemeral scalar only for verification, recomputes the complete transcript, performs constant-time MAC comparison, and clears temporary material.
- After cryptographic verification, one database transaction locks the challenge and invitation, rechecks the immutable challenge digest/version, actor/session/assurance, eligibility, address binding, invitation state/version/expiry, key uniqueness/version, and policy binding; changes the challenge from pending to consumed; creates the claimant key/case bindings and value-free audit/outbox records; and accepts the invitation. Any failed predicate rolls back every mutation.
- Success, expiry, cancellation, and terminal failure destroy the encrypted scalar. A sweeper removes expired ciphertext and records only value-free outcome metadata. A replay or concurrent second consumer receives the same generic denial and cannot distinguish state.
- Verification failures are rate-limited per account, invitation, device context, and network risk signal. Logs contain reason classes and correlation IDs only, never locator, address/digest, public key, scalar, shared secret, proof key, MAC, nonce, salt, or transcript.

## Hostile And Review Cases

The deterministic suite proves the expected fingerprint, canonical bytes, challenge digest, ECDH result, HKDF info/key, MAC input, and MAC. It changes every security-relevant challenge field independently and proves that the reference MAC fails; it also proves failure with another claimant private key. Strict contract tests reject non-canonical Base64URL trailing bits, non-v4 invitation references, unsafe integer versions, and challenge windows other than exactly 300 seconds. Server-only address conformance tests preserve local-part case, lowercase only DNS domains, reject unsupported forms, and reproduce the keyed index. Runtime review must additionally cover malformed/off-curve points, low-level crypto failures, App Attest unavailability/attestation/assertion/counter/environment failures, expired and future challenges, wrong account/session/API audience, stale invitation/eligibility/policy/key versions, address change/recovery, replay, concurrency, partial transaction failure, ciphertext/key-version/nonce/tag corruption, sweeper races, rate limits, enumeration, and log/telemetry leakage.

## Gates Before Live Runtime Work

- Independent cryptographic review approves the exact transcript, P-256 point handling, HKDF/HMAC construction, constant-time verification, AES-256-GCM wrapping profile, and server key-management lifecycle.
- Independent native/security review approves App Attest binding and verifies that production enrollment cannot rely on self-asserted capability metadata.
- Privacy/security review approves `email-ascii-v1`, keyed address indexing, delivery-token expiry/exchange, notification/raw-address retention, recovery, enumeration, and abuse controls.
- The disposable Apple compile and physical passcode-enabled iPhone pass/cancel/retry/cleanup matrix passed. A future production adapter still requires key invalidation, App Attest, reinstall/restore, and derived-secret-clearing evidence.
- Paid-plan hosted claimant MFA enrollment, challenge, recovery, displacement, fresh assurance, and production-shaped session tests pass before external claimant access.
