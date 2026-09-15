# Claimant Slices 5X–5Z runtime foundations verification

Date: 2026-09-15 (Asia/Dubai)

## Result

Combined Slices 5X–5Z pass local verification on `codex/claimant-runtime-foundations`, stacked on Slice 5W head `f352c9a`. The implementation remains synthetic-only, independently literal-false, runtime-disconnected and value-free at its public seam.

## Delivered contracts

- 5X supplies an injected hosted-identity boundary that accepts only a synchronous, fresh, non-recovery AAL2 session with exact issuer and audience.
- 5Y supplies an injected native-shaped signing boundary that accepts only the test alias/fingerprint, verified user presence and a non-exportable private key result.
- 5Z is the separately guarded composition root joining 5X and 5Y to the existing 5U–5V session journey and Slice 5W acceptance path.
- No normal app importer, UI route, Supabase/native/provider import, persistence, ambient network/authentication, hosted mutation, deployment, real data or activation was added.

## Local evidence

- Focused 5X–5Z mobile tests: 33 passed.
- Workspace tests: 1,462 passed with the same three established mobile skips.
- Serial script tests: 288 passed.
- Workspace typechecks: passed.
- Repository zero-warning lint: passed with only the established generated/protected-directory exclusions.
- GitHub Actions security, repository security and Phase 1 checks: passed.
- Mobile secret scan, production dependency audit, claim vectors, claim-vector isolation and custody isolation: passed. The audit reports the existing digest-verified `image-size` exception through 2026-09-30.
- Relevant handoff, possession bridge, session bridge, portal client, journey composition, whole-journey and new runtime-foundation isolation checks: passed.
- Web production build: passed, 24 routes.
- API Vercel bundle check: passed.
- `git diff --check`: passed.

No database acceptance was required because this slice changes no server code, migration, schema, policy or hosted database state.

## Repairs during verification

Focused verification exposed strict request parsing around the injected abort signal, an under-typed mock and an isolation-fixture token; each was corrected without broadening the contract. The full serial suite then showed that the older handoff-client guard did not recognize the new wrapper. Its exception was narrowed to the exact separately guarded 5Z file, with the complete 288-test script suite green afterward.

## Delivery rule

Local green is not CI or preview evidence. Publish the stacked PR and let its dedicated heartbeat watcher own exact-head CI, security, native, hosted Supabase, GitGuardian, Vercel preview and runtime-log evaluation. Confirmed red permits only a narrow in-scope repair, local verification and resubmission; confirmed green permits progression but not automatic merge, deployment, activation or another slice.
