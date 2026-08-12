# Claimant Slice 1F Native Enrollment Transaction

Date: 2026-08-12 (Asia/Dubai)

## Result

The bounded Slice 1F code is complete locally. It implements the single-use challenge
and atomic native registered-recipient acceptance boundary while remaining unmounted,
hard-disabled, and synthetic-only.

Slice status is `LOCAL CODE COMPLETE / APPLE-NATIVE INTEGRATION AND ROUTE REVIEW PENDING`.
No HTTP route calls this code. No hosted migration, production key, Apple request,
provider configuration, deployment, external claimant access, or real data was used.

## Implemented Boundary

- Server-generated App Attest registration challenges and paired native-enrollment/App
  Attest assertion challenges use exact five-minute windows, UUIDv4 identifiers, random
  32-byte nonces/salts, canonical transcript bytes, and SHA-256 transcript digests.
- The native challenge pre-binds claimant/session eligibility, invitation/version,
  proposed claimant key ID/version/fingerprint, server-derived device-context digest,
  API origin, and policy pack. The App Attest assertion transcript binds the same key,
  invitation, claimant, session, origin, and native transcript digest.
- The server ephemeral P-256 scalar is AES-256-GCM sealed under a dedicated 32-byte
  master key with claimant/challenge domain-separated AAD. It is never returned by the
  factory or RPC and is zeroed after opening/verification.
- Native possession verification recomputes the claimant-key fingerprint, validates
  both P-256 points, confirms the envelope scalar matches the transcript public key,
  performs ECDH, applies the approved bounded HKDF-SHA256 labels/context, and compares
  the HMAC in constant time.
- The completion service loads server-stored transcript bytes, checks their stored
  digest and exact canonical encoding, runs the Slice 1E App Attest verifier and native
  possession verifier, then sends only derived verified evidence to the database.
  Raw assertions, possession MACs, private scalars, and client-provided public material
  are excluded from the final acceptance RPC.
- Registration and native/App Attest assertion challenges have explicit
  `issued`/`consumed`/`expired` states. Partial unique indexes allow only one currently
  issued registration challenge per claimant/App Attest key and one native challenge
  per claimant/invitation. Expired challenges are terminalized before retry issuance.
- Registration consumption atomically checks the stored claimant/session, transcript
  digest, App Attest key digest, bundle/category, status, and expiry before registering
  the verified key and consuming the challenge.
- Native acceptance atomically locks both challenges, the App Attest key, and invitation;
  rechecks claimant portal session/eligibility, invitation status/version/address/self-
  acceptance, transcript cross-bindings, App Attest key/counter, bundle/category, and
  challenge state; then creates the exact pre-bound claimant key/case, accepts the
  invitation, advances the App Attest counter, consumes both challenges, and appends
  audit/outbox events in one transaction.
- The dedicated native acceptance mutation preserves the transcript's pre-bound
  claimant key ID. It does not reuse the legacy acceptance RPC, which generates a key
  ID internally and therefore cannot safely represent the signed native transcript.
- Both challenge tables use forced RLS, explicit anon/authenticated deny policies, zero
  client grants, narrow service-role grants, and security-invoker functions.

## Hostile And Atomicity Evidence

- Changed registration transcript digest is rejected without consuming its challenge.
- Changed App Attest assertion transcript digest is rejected without accepting the
  invitation, advancing the counter, or consuming either native challenge.
- A consumed challenge cannot be reused under a new idempotency key.
- Exact same-request replay returns the recorded result and creates one key/case only.
- Expired/not-yet-valid transcripts, altered proof MAC, wrong ephemeral scalar,
  off-curve key, envelope tampering, cross-claimant envelope opening, altered stored
  bytes, cross-challenge IDs, non-increasing counters, and malformed RPC results fail.
- RPC/database errors are redacted by the service adapter.

## Non-Goals And Remaining Gates

- No route, controller mount, public/deep link, invitation delivery-token exchange,
  hosted MFA client, verified-address resolver, rate limiting, or abuse controls.
- The RPC accepts only server-authoritative derived inputs, but a future route must
  derive the verified address and eligibility/session context itself; clients must
  never submit either as authority.
- No production master key/configuration, KMS/HSM integration, key rotation, backup/
  restore exercise, or ephemeral-envelope deletion/retention job is selected.
- No Apple-issued fixture or physical Slice 1D output was used. Slice 1D/1E Apple-native
  integration, root provenance, and independent Apple/cryptographic review remain gates.
- Hosted Supabase MFA, privacy/retention, notification, cooldown, reviewer, and launch
  controls remain unchanged and mandatory before external access.

## Verification

- Complete API suite: 106 tests passed across 31 files.
- Focused Slice 1F cryptographic/service tests: 13 tests passed across 6 files.
- Live local PostgreSQL transaction test passed, including registration issue/consume,
  native challenge issue/acceptance, counter advancement, exact-once replay, consumed-
  challenge rejection, changed-binding rejection, and failed-transaction atomicity.
- Migration contract and database security catalog tests passed.
- All workspace typechecks passed.
- Full repository lint passed after the final correction.
- Repository security, Supabase catalog, hostile RLS, GitHub Actions security, claimant
  custody/vector isolation, mobile secret scan, and `git diff --check` passed.

## Exact Code Snapshot

Aggregate SHA-256: `0503c63a1510034028c48fc1d6fb64188b36f87ca1c3f63cb1080079177d611c`

Aggregate algorithm: ordinal path sort; SHA-256 each complete file; serialize
`<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.

| Path | SHA-256 |
| --- | --- |
| `.github/workflows/security-ci.yml` | `02a7b84e6c6ccd468c6bc6e247a8c7bcc677734d4d90c3dfea83807c573b225f` |
| `package.json` | `43c5de839541dff9518d444f47f9cc03e6f10d4ac91de3703f9ad8460c3276f0` |
| `scripts/claimant-native-enrollment-db-test.cjs` | `b524b2f167c417d69c0ffa5eac200bef8486175cedf7bc7952f60bc2268320f6` |
| `scripts/claimant-native-enrollment-migration.test.cjs` | `6473ea2e9a1721771dc3315cc3e8fc8dd5f590d4a2a14b6a46e1322c7554b496` |
| `scripts/supabase-db-security-check.cjs` | `4f8a64d2357ff1e23604cacb3dcb9511922f587419e41dead0db50bb3f3474fa` |
| `scripts/supabase-db-security-check.test.cjs` | `7edf1eb0107507eebe94655aeaad61d60e3394b22de453e9eceb0b6a7d703734` |
| `services/api/src/claimant/native-enrollment-acceptance-verifier.test.ts` | `51698f72a4d520a68a14a5247c9a27ab933110461c40a0014c75887ab2a1249d` |
| `services/api/src/claimant/native-enrollment-acceptance-verifier.ts` | `b6e22824f1b300fb1c45940a182f1b63e62f24e57d0b820af378e30985c7ed62` |
| `services/api/src/claimant/native-enrollment-challenge-factory.test.ts` | `e2de97571f2e1bb301f305c3aa8d2c972cffd41c8a90409f61dc762939d68193` |
| `services/api/src/claimant/native-enrollment-challenge-factory.ts` | `e03bf40cd6debf72c86581bcb370af39500b3d9197b866e64c93fefca1d00815` |
| `services/api/src/claimant/native-enrollment-possession-verifier.test.ts` | `fc1c2a87feaafa5f0744a2e7c9ede1477c35894a61e4a7f381e91e357eb87786` |
| `services/api/src/claimant/native-enrollment-possession-verifier.ts` | `9b046d2c4386900726464e7b4db04d4896f647d998a86fb4104ecc4feb8693f8` |
| `services/api/src/claimant/native-enrollment-service.test.ts` | `33998a992fb9627fe3a5d7a6a8496f3c6329e284fc5e0f3922e70ecdb49e698a` |
| `services/api/src/claimant/native-enrollment-service.ts` | `6bdfa3cbf075c38d55e85bff192696adf708c511df05675c25789e4d90a98f56` |
| `services/api/src/claimant/native-enrollment-transaction-client.test.ts` | `fad859ed9ff10a033d8d9ba38b44fe5d6e43b9a03f627609a9d5b3d311b54f70` |
| `services/api/src/claimant/native-enrollment-transaction-client.ts` | `b67e9b5be1db2a9da7ab19d4c7b82ed79077579fa3066f4b1d57bde635c825df` |
| `services/api/src/claimant/server-ephemeral-key-custody.test.ts` | `09ec79bf44fe869c9eaebeeb22c83643a7505de0c346902869e29b7e2646b3c3` |
| `services/api/src/claimant/server-ephemeral-key-custody.ts` | `ee1f978048538933bb40a309459f16ef7e585c0f325aa1510e243c0088c67881` |
| `supabase/migrations/20260812150000_claimant_native_enrollment_challenges.sql` | `2424feb0dd06e3ab80a58296c9cf821727567f93893727bfb94c0bed25042027` |

## Next Slice

The next bounded slice is the disabled HTTP/controller integration. It must derive the
authenticated claimant, active portal session/fresh AAL2, verified-address digest,
eligibility, invitation binding, and approved server configuration; apply exact origin,
content-type, size, schema, idempotency, throttling, enumeration resistance, and safe
error behavior; call only the Slice 1F service; and remain concealed while disabled.

That route may not be activated until the recorded Apple-native integration and hosted
MFA gates pass. Any Slice 1F source change requires new hashes and repeat verification.
