# Native Enrollment Review Closure And Remediation Decision

Date: 2026-08-12 (Asia/Dubai)

## Owner Decision

The owner reviewed `2026-08-12-native-enrollment-adversarial-pre-review.md` and explicitly
decided that it closes the Slice 1B/1C independent-review gate for this project. The
owner accepts the reviewer's disclosed status and qualifications as an exception to the
earlier requirement for a separately retained qualified human reviewer.

This decision authorizes bounded engineering remediation and subsequent disabled,
synthetic native/server implementation slices. It does not authorize deployment,
external claimant access, real claimant data, provider/DNS/Apple account changes, or
production activation.

## Authenticated Review Input

- Slice 1B aggregate `4abdfb3230f96ada853f3ae096c28e8efc282cf5fbadf99e41d081a6780d3100`: reproduced.
- Slice 1C aggregate `a7bf764d6e4d1cc44175fadde533d73237e198b6e6680b8915b2b833306515cf`: reproduced.
- Individual manifest entries: 25/25 reproduced byte-for-byte.
- Reviewer relationship, conflicts, methods, findings, uncertainty, and advisory
  decisions are disclosed in the referenced pre-review.

## Remediated Snapshot

- Slice 1B fourteen-file aggregate: `c837de44f5da4f71c149d9e90b1a4a79ee39eeda72eb11985063e2838a003bd1`.
- Slice 1C seventeen-file aggregate: `7ac6028f4e0fd4475122af264e2e7754e9c88d702cc154a6a8f39627cb07b337`.
- Remediation ZIP: `review-packages/sanduqkin-native-enrollment-review-remediation-2026-08-12.zip`.
- ZIP SHA-256: `52554c9428fb5072524fa67509b21a348a815db8f726b2094d35dbed093d2167`.
- ZIP contents: 29 unique manifested source/test/vector files plus 12 supporting
  specification/evidence files, with repository paths preserved. This closure is a
  detached companion and is intentionally excluded so the ZIP hash is not recursive.
- The original 2026-08-04 ZIP remains unchanged.

## Finding Disposition

| ID | Disposition | Closure requirement |
| --- | --- | --- |
| SK-01 | Accepted | Add canonical serializer and test to the frozen manifest and regenerate aggregates. |
| SK-02 | Accepted | Native client authenticates server-issued opaque challenge bytes and never reserializes the transcript. |
| SK-03 | Corrected and accepted in part | Apple documents `apple_validation_category_01` and `apple_bundle_version_01` authenticator-data extensions on iOS 27+. The verifier must extract and compare the Apple values; absence fails closed for V1. |
| SK-04 | Accepted | Verifier performs on-curve/non-identity validation, rejects an all-zero shared secret, and carries genuine malformed-point tests. |
| SK-05 | Accepted | Server recomputes the domain-separated public-key fingerprint and never trusts the client value. |
| SK-06 | Accepted | Address-index key uses separated custody and revoke/reissue rotation described below. |
| SK-07 | Accepted | App Attest/key lifecycle actions create claimant-visible and owner-visible value-free events and enforce a configurable cool-off before finalization/release. |
| SK-08 | Accepted | Uppercase local parts require explicit issuance confirmation; mismatch uses a non-enumerating reissue path. |
| SK-09 | Accepted | Registration now binds the exact API audience. |
| SK-10 | Accepted | Capability properties are named as client claims and cannot authorize enrollment. |
| SK-11 | Accepted | Device context is server-derived; clients cannot choose it in the challenge request. |
| SK-12 | Accepted | Server-generated protocol identifiers require UUIDv4. |
| SK-13 | Accepted | URL parsing failures map to stable domain errors. |
| SK-14 | Accepted | HKDF reference implementations enforce RFC 5869's 255-block bound. |
| SK-15 | Accepted property | Plus aliases remain deliberately distinct; email address is never evidence of a distinct human. |

## Apple App Attest V1 Policy

Apple's current validation guidance defines two authenticator-data extensions:
`apple_validation_category_01` (`UInt32`) and `apple_bundle_version_01` (`String`).
Categories `2`, `3`, and `4` mean TestFlight, development-signed, and App Store
distribution. Apple identifies these extensions as iOS 27+ signals and requires
assertion extensions to be handled like attestation extensions.

For claimant enrollment V1:

- iOS 27 or later is required even though the general owner application has an older
  deployment target.
- The server extracts the actual values from Apple-authenticated CBOR; it does not
  accept decoded values from the client.
- Missing, duplicated, malformed, unexpected, or policy-mismatched extensions fail
  closed.
- TestFlight/App Store categories require the production App Attest environment;
  development category is confined to separated development configuration.
- Bundle version and category are compared with server policy on registration and each
  assertion. They are not merely echoed client-data tags.

Primary references:

- https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
- https://developer.apple.com/videos/play/wwdc2026/201/

## Address-Index Key Custody And Rotation

- `address_index_key_v1` is a 256-bit key held in an approved KMS/secret manager in a
  trust boundary separate from the claimant database and application rows.
- Runtime receives only narrowly authorized HMAC use; the key is never logged,
  exported to clients, included in backups with claimant tables, or stored beside an
  invitation row.
- Every invitation records a non-secret key version. Active key material and retired
  decrypt/use authority are inventoried, access-reviewed, monitored, and independently
  revocable.
- Rotation uses a bounded dual-read window only where required for an orderly change.
  Because raw recipient addresses are not retained in claim tables, pending invitations
  under a retired or suspected key are revoked and reissued; indexes are never silently
  recomputed.
- Emergency rotation immediately disables invitation issue/acceptance, revokes affected
  pending invitations, rotates the key, reissues through the approved notification
  boundary, reconciles audit/outbox state, and reopens only after synthetic verification.
- The production key-management runbook must be drilled before external access.

## Key-Lifecycle Security Events

App Attest registration and claimant-device-key enrollment, replacement, and revocation
are security-sensitive operations. Each successful or attempted material change must:

- require the approved fresh AAL2 and active claimant context;
- append a value-free server-authored security event;
- notify the claimant and owner through approved value-free channels without revealing
  addresses, keys, device identity, claim facts, or evidence;
- enter a configurable, policy-versioned cool-off during which the new key cannot
  participate in owner finalization, release authorization, or retrieval;
- invalidate affected grants/approvals/packages where the lifecycle policy requires;
- cap active App Attest and claimant keys per claimant and provide explicit reinstall,
  loss, replacement, dispute, and rollback paths.

The duration is a production policy value requiring security/operations approval; it
must not be silently hard-coded. Synthetic tests must cover stolen-session enrollment,
duplicate delivery, cancellation, dispute, and cool-off expiry.

## Exact-Case And Alias Handling

- Email local-part case remains exact; only DNS-domain case is folded.
- Issuance with uppercase local-part characters requires explicit owner confirmation
  and clear copy that the claimant identity must match the exact spelling.
- Acceptance mismatch exposes no invitation existence or address detail. The safe path
  is an authenticated owner reissue that revokes the prior pending invitation.
- Provider-specific case folding or plus-tag removal is prohibited.
- Plus aliases may identify one mailbox through multiple addresses. Any future
  distinct-human rule must use evidence other than email-string distinctness.

## Remaining Boundary

The accepted review and remediation close the design-review stop gate. Runtime slices
must still supply their own code, Apple SDK/device, persistence, concurrency, privacy,
and hostile-test evidence before they can be called complete. All claimant production
flags remain false until separate launch authorization.
