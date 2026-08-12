# Claimant Slice 1C App Attest Contract

Date: 2026-08-04 (Asia/Dubai)

Status: runtime-disconnected contract and synthetic binding vector complete; independent native/security review and production implementation remain required.

## Purpose And Non-Authorization

Slice 1C defines how a future iOS claimant enrollment flow proves that the possession-proof request comes from a server-recognized instance of the intended app. It does not enable App Attest, add an entitlement, call Apple, generate an App Attest key, parse CBOR, mount an endpoint, persist an attestation, accept an invitation, or create a production claimant key alias.

App Attest is an app-integrity signal, not absolute device integrity and not direct attestation of the separate claimant P-256 ECDH key. The future server requires both:

1. a verified App Attest assertion bound to the exact native-enrollment challenge and claimant public-key fingerprint; and
2. the existing Secure Enclave P-256 possession proof.

Neither proof substitutes for fresh AAL2, portal eligibility, invitation/address binding, policy checks, or atomic server authorization.

## Apple Trust Model

The design follows Apple's current App Attest validation guidance:

- Generate one App Attest key per user account per device; never share it across users.
- Attestation uses a unique server challenge through `clientDataHash` and registers the key with the server.
- Server validation checks the Apple certificate chain, nonce construction, credential/public-key binding, expected RP ID, counter `0`, environment AAGUID, receipt, and the iOS 27+ `apple_validation_category_01` and `apple_bundle_version_01` authenticator-data extensions.
- Assertions sign server-reconstructed client data. The server verifies the signature, RP ID, strictly increasing counter, challenge binding, and directly extracted Apple extension values. Client-supplied decoded extension values are prohibited.
- Development and production key/receipt/counter state are separate. TestFlight and App Store distributions use the production App Attest environment.
- Unsupported App Attest fails closed for claimant key enrollment. There is no bypass or software-integrity downgrade in V1.

Primary references:

- `https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity`
- `https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server`
- `https://developer.apple.com/documentation/devicecheck/attestation-object-validation-guide`
- `https://developer.apple.com/documentation/devicecheck/preparing-to-use-the-app-attest-service`

## Registration Contract

The app first generates one App Attest key identifier in a future reviewed native adapter. The authenticated API derives a domain-separated SHA-256 digest of the decoded 32-byte key identifier and issues a 300-second registration challenge binding:

- registration protocol and random UUIDv4 challenge ID;
- server-derived claimant and claimant-portal session IDs;
- App Attest key-ID digest;
- server-configured App ID hash;
- exact development/production environment;
- server-required bundle version and Apple validation category, compared with the Apple-authenticated iOS 27+ extensions;
- exact HTTPS API audience;
- issue/expiry timestamps and an independent 32-byte nonce.

The client submits only the challenge ID, canonical 32-byte App Attest key identifier, and opaque Base64 attestation object. It cannot submit a counter, validity decision, RP ID result, AAGUID, receipt, certificate chain, app identity, claimant authority, or key-custody assertion.

The future server reconstructs canonical client data, hashes it with SHA-256, and performs every Apple validation step itself. Successful registration stores the verified App Attest public key, key-ID digest, app/environment identity, current counter, bounded receipt/key metadata, claimant/device association, and value-free audit outcome. It never trusts decoded fields supplied separately by the client.

## Enrollment Assertion Contract

For each native-enrollment attempt, the server issues a fresh 300-second App Attest assertion challenge binding:

- assertion protocol and random UUIDv4 challenge ID;
- digest of the complete immutable native-enrollment challenge;
- server-derived claimant, claimant key/version, invitation/version, and portal session;
- claimant public-key fingerprint;
- registered App Attest key-ID digest;
- server-configured App ID hash, environment, expected bundle version, and validation category;
- exact HTTPS API audience;
- issue/expiry timestamps and independent 32-byte nonce.

The client calls `generateAssertion` over `SHA-256(canonical_client_data)` and submits only the challenge ID, registered App Attest key identifier, and opaque assertion object. The future server locks the App Attest key/counter and challenge, reconstructs client data, verifies the assertion, requires a strictly increasing counter, and consumes the challenge atomically with the native possession proof and invitation transition. Counter rollback, equality, gaps outside approved policy, parallel use, cross-user key reuse, environment drift, and replay fail closed.

## Exact Contract Boundaries

- App Attest key identifiers are canonical standard Base64 encoding of exactly 32 bytes. Persistent/loggable authority uses only the domain-separated digest.
- App ID, environment, required bundle version/category, claimant/session/invitation/key bindings, timestamps, audience, and nonces are server authority. Actual bundle version/category are extracted from Apple-authenticated CBOR.
- Distributed validation categories `2` (TestFlight) and `4` (App Store) require the production environment. Development category `3` is accepted only by explicitly separated development configuration.
- Claimant enrollment V1 requires iOS 27+ and both Apple extensions. Missing, duplicate, malformed, unexpected, or policy-mismatched extension values fail closed.
- Opaque attestation/assertion objects are bounded canonical Base64. Contract validation does not imply CBOR, certificate, signature, RP ID, AAGUID, receipt, extension, or counter validity.
- The deterministic vector's opaque objects are synthetic bytes and explicitly not Apple-issued.
- App Attest key IDs, assertions, receipts, public keys, counters, and fraud metrics are excluded from client logs, analytics, URLs, crash reports, and value-bearing audit events.
- Server receipt retention, fraud-metric use, Apple credential custody, counter-gap policy, rollout, outage response, and key replacement require privacy/security/operations approval.

## Hostile Cases Before Runtime

- malformed/noncanonical/oversized Base64 and malformed CBOR;
- invalid/untrusted/expired certificate chain and wrong Apple root;
- nonce, credential ID, key-ID, App ID/RP ID, AAGUID, category, bundle, or environment mismatch;
- changed claimant, session, invitation, native challenge, claimant key/fingerprint, API audience, timestamp, or nonce;
- assertion signature failure, zero/equal/decreasing/replayed/concurrently consumed counter;
- one App Attest key associated with another user or environment;
- unsupported service, key loss, reinstall/restore, account switch, recovery, passcode change, compromised-device risk, Apple outage, and receipt refresh failure;
- telemetry, proxy, support, crash, or audit leakage.

## Exit And Stop Gate

The Slice 1C contract exit gate requires strict shared validation, deterministic client-data/key-ID-digest reproduction, mutation of every bound field, mobile/API consumers, hard-disabled runtime, vector/custody isolation, typecheck, lint, and security checks.

Stop before native DeviceCheck code, entitlements, live verification, database state, challenge endpoints, or invitation acceptance until:

- independent native/security review approves this binding and Apple's complete validation algorithm;
- production App ID, bundle/environment/category policy, receipt/counter lifecycle, Apple credentials, and outage/fallback policy are approved;
- the production adapter and server verifier are implemented in separately reviewed slices with real Apple sandbox/TestFlight evidence;
- the possession-proof, invitation/privacy, delivery-token/retention, and paid-plan hosted MFA gates also close.
