# Claimant Slice 1G Native Enrollment Controller

Date: 2026-08-12 (Asia/Dubai)

## Result

The bounded Slice 1G code is complete locally. It mounts the four native-enrollment
HTTP operations behind an immutable compile-time approval set to `false`, so every
operation remains concealed as `404` before configuration, origin, authentication, or
database work occurs.

Slice status is `LOCAL CODE COMPLETE / HARD-DISABLED / APPLE-NATIVE AND HOSTED MFA
GATES OPEN`. No hosted migration, provider or DNS change, Apple request, deployment,
external claimant access, production secret, or real claimant data was used.

## Implemented Boundary

- Mounted registration challenge issue/complete and paired native challenge
  issue/complete paths are present, but an immutable route-approval constant and the
  registered-recipient capability must both permit execution. The immutable approval
  is currently `false` and is checked before configuration or CORS handling.
- Enabled-path logic requires an exact approved HTTPS origin, strict JSON content type,
  dual body-size limits, UUIDv4 idempotency keys, bearer authentication, confirmed
  email, fresh AAL2, and an active claimant portal session.
- The server derives the claimant and session from the verified bearer token. It
  normalizes the confirmed email with exact-case local-part/domain-only folding and
  creates the keyed address digest itself; the client cannot submit identity, address,
  eligibility, invitation version, policy, app identity, or acceptance authority.
- A service-role authority query rechecks the active portal session, synthetic-only
  eligibility, pending/unexpired invitation, exact address binding, non-self owner,
  and active App Attest key before challenge issuance.
- The App Attest key digest and device binding are derived server-side. Strict schemas
  reject authority-shaped and private-key fields, unknown fields, malformed encodings,
  cross-path challenge identifiers, and changed proof bindings.
- Approved app identity, bundle, validation category, policy pack, origins, trust roots,
  and custody keys are parsed from bounded server configuration. Invalid or incomplete
  configuration fails closed and is never consulted while the route is disabled.
- A forced-RLS, service-role-only database limiter enforces fixed 15-minute per-account
  budgets for each of the four operations. Safe generic errors, `no-store`, MIME-sniffing
  protection, exact CORS responses, and concealed disabled behavior prevent authority
  or configuration detail from being returned.
- The completion paths call only the prior Slice 1E/1F verifier and transaction
  boundaries. Registration and native challenge identifiers must match both the path
  and submitted cryptographic proof before those services run.

## Hostile Evidence

- Disabled requests and preflights return `404`, expose no CORS allowance, and never
  load server configuration.
- Client-supplied claimant/address/eligibility/version/policy authority is rejected by
  strict schemas.
- Stale assurance, rejected database throttles, hidden authority, evil origins,
  oversized bodies, malformed idempotency, and path/proof mismatch fail closed.
- Database evidence proves exact authority succeeds, a changed confirmed-address
  digest is denied, five native-issue attempts are permitted, and the sixth is rejected.
- The new limiter and authority table/functions remain forced-RLS, client-denied, and
  limited to narrow service-role grants.

## Non-Goals And Remaining Gates

- The route approval is intentionally not configurable and remains `false`. No endpoint
  may be activated by changing environment variables alone.
- The authority source is intentionally restricted to `synthetic_fixture`; this is not
  a production eligibility or invitation-delivery implementation.
- No unauthenticated/per-network edge limiter, adaptive mitigation, WAF, origin shield,
  CAPTCHA, or provider cost control was selected. Per-account database throttling does
  not replace the required pre-authentication edge controls.
- No hosted Supabase migration or MFA enrollment/challenge/recovery verification was
  performed. Fresh-AAL2 enforcement remains mandatory and its hosted gate remains open.
- No Apple-issued registration/assertion fixture, physical Slice 1D integration output,
  production App Attest trust-root configuration, production custody-key management,
  or independent Apple/native/cryptographic approval was supplied.
- Privacy/retention, notification, cooldown, reviewer, production observability,
  backup/restore, incident response, and launch governance gates remain unchanged.

## Verification

- Complete API suite: 114 tests passed across 33 files.
- Focused controller, binding, and mount tests: 10 tests passed across 3 files.
- Live local PostgreSQL controller-authority/rate-limit test passed.
- Controller migration, security catalog, repository security, hostile RLS, prior native
  transaction database, GitHub Actions security, custody/vector isolation, and mobile
  secret checks passed.
- All workspace typechecks and full repository lint passed.
- `git diff --check` passed; line-ending conversion warnings are informational.

## Exact Code Snapshot

Aggregate SHA-256: `6b74a3ff7c85accfe1c0cf48935a35c2f49e05bc0d4e3de55600d379b2591799`

Aggregate algorithm: ordinal path sort; SHA-256 each complete file; serialize
`<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.

| Path | SHA-256 |
| --- | --- |
| `.github/workflows/security-ci.yml` | `d288d96a17e8837defb8270d42c03812469571e26950c87f346c05483c537496` |
| `package.json` | `739d413f4ebdff20c833d2cc8f6d2fe7cc8c8bf121ea26ad22018b260dfd6ea5` |
| `scripts/claimant-native-enrollment-controller-db-test.cjs` | `b1c0b3ad4ed55297f98dfad13f04c93ab2d6ad64b2f551066d60d7c9e81a41e3` |
| `scripts/claimant-native-enrollment-controller-migration.test.cjs` | `e8a036070e77aa917412a670f9c564028a482f50c1d2cde537bedb785354ed29` |
| `scripts/supabase-db-security-check.cjs` | `6921a5c9438fd7b9f430578df7e34df226dfafe8eb5c5f95708f70b3f6a2300c` |
| `scripts/supabase-db-security-check.test.cjs` | `5c414380cb118234b4594708c6484e1bb05d7dac2155a842e58472a28036e05f` |
| `services/api/src/claimant/native-enrollment-authority-client.ts` | `7fd42d5a3a54a257c0b1eef2f833ef1cf8385e0551ac975e80e8d5223b073e45` |
| `services/api/src/claimant/native-enrollment-controller-bindings.test.ts` | `c45297a0fe2f21f388fc50a9ecb0bae0064e47c7028ae6cb8a6a87174161746f` |
| `services/api/src/claimant/native-enrollment-controller-bindings.ts` | `5fa1d743193075b7f36f57c2654d2b04a8068a3ba7793f591c28fbd04893fe18` |
| `services/api/src/claimant/native-enrollment-routes.test.ts` | `10b44ca95ee5438ed3c5d081d30315edcd5e053616cb6d3e3e84125e7d1ef2e9` |
| `services/api/src/claimant/native-enrollment-routes.ts` | `963f8188bd89ce6f19f88e9ec0ae7c9be0ad42a7ef66ede8cc64b15417ff87ba` |
| `services/api/src/claimant/server-ephemeral-key-custody.test.ts` | `748f144fff7d772618b09060651238e70a27071ffb09cb3d0a880740fbff993c` |
| `services/api/src/index.test.ts` | `b43029a256b98c117b6b7427bc703488f6b374bd154c9b571f732117ba816f2b` |
| `services/api/src/index.ts` | `398112189e74e5d066b8dc6660d8b5c583ec680781c263f0c7e63969fa3cb092` |
| `supabase/migrations/20260812170000_claimant_native_enrollment_controller_authority.sql` | `74d2a0d29393aba7e1b02f261352667c9c5a0c6ffcdd2ab9948a0953afbf1431` |

## Next Slice

The next bounded local slice may implement a hard-disabled mobile enrollment
coordinator/transport adapter that consumes only these public challenge responses and
the existing native custody/App Attest adapters, with cancellation, cleanup, replay,
and value-free telemetry tests. It must not bypass the immutable server route approval.

Route activation remains a separate decision and is prohibited until Apple-issued
end-to-end evidence, hosted MFA evidence, production configuration/key custody,
pre-authentication edge abuse controls, and independent native/cryptographic review are
recorded against one immutable candidate.
