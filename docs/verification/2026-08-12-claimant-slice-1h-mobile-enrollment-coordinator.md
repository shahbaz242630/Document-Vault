# Claimant Slice 1H Mobile Enrollment Coordinator

Date: 2026-08-12 (Asia/Dubai)

## Result

The bounded Slice 1H mobile transport and orchestration code is complete locally and
runtime-disconnected. Its immutable coordinator approval is `false`, and the repository
isolation guard rejects any normal mobile-runtime import.

Slice status is `LOCAL CODE COMPLETE / HARD-DISABLED / PRODUCTION NATIVE ADAPTER AND
ACTIVATION GATES OPEN`. No native probe alias was promoted, no app screen or route was
added, and no network, Apple, hosted Supabase, build, deployment, external claimant,
production credential, or real data was used.

## Implemented Boundary

- The transport accepts only an exact HTTPS API origin, obtains the bearer token at
  request time, rejects missing/whitespace/oversized tokens, sends credentials omitted,
  disables caching and redirects, and uses a caller-provided UUIDv4 idempotency key.
- Registration issue/complete and native issue/complete requests contain only the
  public controller fields. Client policy, identity, address, eligibility, invitation
  version, device digest, and acceptance authority are never submitted.
- Every server response is strictly allowlisted, byte-bounded, runtime-validated, and
  checked for canonical challenge-byte equality. Paired native and App Attest
  challenges must agree on claimant, claimant key, invitation, and fingerprint.
- Completion revalidates App Attest and possession responses at runtime and requires
  both submitted challenge identifiers to match their URL/body bindings.
- Transport failures collapse to bounded classes; response bodies, bearer tokens,
  native errors, Apple objects, and server details are not included in thrown messages.
- The coordinator executes registration before claimant-key creation, then creates the
  claimant key, obtains the paired challenge, creates native possession and App Attest
  proofs, and submits the exact completion objects.
- A newly created claimant key is deleted on cancellation or failure before final
  acceptance. Once final acceptance has been attempted, an ambiguous response preserves
  the key and returns only `reconciliation_required`, because the server may already
  have committed the enrollment.
- The coordinator is adapter-injected. It deliberately does not import the current
  disposable `test_alias_only` Secure Enclave or App Attest probe modules.

## Hostile Evidence

- Immutable denial occurs before adapter, token, or transport work.
- Malformed origins, tokens, idempotency keys, responses, canonical bytes, paired
  challenge bindings, proof bindings, response sizes, status codes, redirects, and
  cancellations fail closed.
- Strict request inspection proves no client policy, claimant, eligibility, or other
  authority-shaped fields are sent.
- App Attest key changes between operations and native proof rebinding are rejected.
- Pre-finalization failures delete the new key; cancellation before key creation does
  not call cleanup; ambiguous final acceptance preserves the key for reconciliation.
- The repository isolation check now requires immutable coordinator denial, prohibits
  probe imports/promotion, and rejects imports from normal mobile runtime.

## Non-Goals And Remaining Gates

- There is no screen, navigation route, deep link, runtime configuration, Supabase auth
  integration, or production native adapter. The slice cannot execute from the app.
- Existing native custody and App Attest modules remain disposable probe-only aliases.
  They are not suitable enrollment keys and were not wired into this coordinator.
- Durable encrypted enrollment-attempt persistence, process-death recovery, stable
  replay after restart, and server reconciliation for ambiguous completion remain a
  separate slice. This implementation reports the ambiguity and preserves the key but
  does not claim recovery is complete.
- No production claimant key alias/lifecycle, App Attest key lifecycle, biometric copy,
  accessibility testing, physical iPhone execution, Apple-issued end-to-end fixture,
  or independent native/cryptographic review was performed.
- The Slice 1G server route remains immutably concealed. Hosted MFA, edge abuse controls,
  production configuration/custody, hosted migrations, privacy/operations, and launch
  governance remain mandatory activation gates.

## Verification

- Complete mobile suite: 439 tests passed across 118 files; 3 environment-gated tests
  were skipped.
- Focused transport/coordinator suite: 9 tests passed across 2 files.
- All workspace typechecks passed.
- Full repository lint passed after the final change.
- Repository security, claimant custody/vector isolation, mobile secret scan, and
  `git diff --check` passed.

## Exact Code Snapshot

Aggregate SHA-256: `923b8d9eccb69e411f2b209fe29a5da035b303235ec7dd7aa9b317301134fde0`

Aggregate algorithm: ordinal path sort; SHA-256 each complete file; serialize
`<lowercase-sha256><two spaces><path>` joined by LF; SHA-256 the UTF-8 serialization.

| Path | SHA-256 |
| --- | --- |
| `apps/mobile/src/features/claimant-enrollment/native-enrollment-coordinator.test.ts` | `93a6a0400cc7bdcc35b71f5ea6bf7d76953ff31c2af4d547b88c4b9e75589703` |
| `apps/mobile/src/features/claimant-enrollment/native-enrollment-coordinator.ts` | `e9d11c503e63f3b166bf0d85b7dcd63a43a3c7c46c68879ab881431a66d2b1b3` |
| `apps/mobile/src/features/claimant-enrollment/native-enrollment-transport.test.ts` | `716a9a4c38ae41b97fdd9bad7a525d1a69f674aaa12fc6e795773c074af7fadb` |
| `apps/mobile/src/features/claimant-enrollment/native-enrollment-transport.ts` | `bf5d567f831c8934b917873a106069ce83b1b1be79ff5df5f95c1af6835b237f` |
| `scripts/claim-custody-isolation-check.cjs` | `a76b72b334d10327d017e1897c7a4822c69dfb81878e0bc9728ce493704025c9` |

## Next Slice

The next bounded local slice is encrypted, hard-disabled enrollment-attempt persistence
and reconciliation. It must retain stable idempotency/challenge state across process
death, distinguish safe cleanup from uncertain server commit, retry only exact stored
requests, clear state after authoritative success, and remain unreachable from the
normal app until production native adapters and every activation gate are approved.
