# Sanduqkin Claimant Engineering Handoff

## Current checkpoint — session close with Slices 6I–7A, 2026-09-26

The canonical close-out and next-session opener is `docs/handoff/2026-09-26-claimant-6i-7a-session-close.md`.

Merged this session:
- 6I, the camera QR scanner, through PR #100 (`0edd2a8`);
- 6J, "My emergency sheets", through PR #101 (`9d07c65`);
- 7A, the single human approver with safeguards, through PR #102, which merges at session close once CI is green.

Owner decisions:
- a single human approver (Shahbaz Malik), with Claude pre-checks and the 7A safeguards;
- reuse the existing Supabase and Vercel projects, with claimant features on in Preview only;
- offline-only coding stops here, and wiring to hosted staging and production is next;
- docs always travel with code;
- PR watchers merge when green.

Next: staging wiring W1 once the tokens exist, otherwise the 7B reviewer console spec.

## Current checkpoint — Slice 7A single human approver, 2026-09-26

Slice 7A is locally complete. The owner approved the spec with all five recommended decisions: deterministic pre-checks only, a minimum 30-day cooldown, a 7-day dispute window, no override of blocking pre-checks, and no self-resolution of escalations or appeals.

Claims can now be approved by one accountable human, Shahbaz Malik, instead of two independent reviewers:
- **Mode by policy.** The server chooses the review mode per policy pack. The two-person path is untouched.
- **Pre-checks.** Automated pre-checks can only block.
- **Approval.** One allow from an `accountable_human_test` identity opens a post-approval dispute window.
- **Dispute window.** The window starts only when the owner's approval notice is verified. During it:
  - the owner can cancel;
  - the claimant, or another next of kin, can dispute;
  - a material change holds the approval.
- **Release.** Release requires an elapsed, undisturbed window, a clear pre-check taken after it, and the same person re-confirming with fresh MFA.
- **Audit.** Every review, intervention, release and single-approval step is hash-chained, and the chain can be verified and exported.
- **Launch state.** Everything is synthetic, literal-false and unmounted.

Evidence:
- The full DB test passed on real Postgres (PGlite, all migrations), and 4 mutation tests prove its guards.
- Every other claimant DB test still passes.
- The catalog check shows 0 violations.
- 1,692 workspace tests and 290 script tests pass.

Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-7a-single-approver-review.md`; evidence: `docs/verification/2026-09-26-claimant-slice-7a-single-approver-review.md`. `docs/verification/2026-08-18-interim-reviewer-test-roles.md` now carries the superseding single-approver go-live gate.

Next: 7B, the reviewer console, built against staging; then staging wiring. Staging needs `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN`, added either to the cloud environment settings or as GitHub secrets.

## Current checkpoint — Slice 6J "My emergency sheets", 2026-09-26

Slice 6J is locally complete, on top of Slice 6I (PR #100). The owner approved the spec and both decisions: print a short reference on each sheet, and list without a fresh TOTP.

The owner can now see their emergency sheets and revoke one:
- **Server.** A new service-only, read-only SQL function `claimant_list_offline_code_v2_locators` returns only the owner's own sheets, with dates and a status. It never returns the locator digest, commitment, proof key, wrap, salt or grant. It sits behind a concealed `GET /owner/offline-code/v2/locators` route that needs an active AAL2 owner session. Revoking still needs a fresh TOTP, and the retry reuses the same idempotency key.
- **App.** A "My emergency sheets" screen shows each sheet's reference ("Ref 3F9A1C"), printed date, validity and status, with a confirmed Revoke. The 6H printed sheet now shows the same reference.
- **Launch state.** It sits behind the same literal-false launch approval as 6H.

An acceptance test prints two sheets, lists them, revokes one after a fresh code, and shows that one yields only a decoy while the other still proves possession. The SQL was checked locally on real Postgres (PGlite), and a new Docker-backed DB step runs in security CI. Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-6j-owner-sheet-list.md`; evidence: `docs/verification/2026-09-26-claimant-slice-6j-owner-sheet-list.md`.

**Owner working rule (2026-09-26).** No pull request for documentation or admin changes alone. Handoffs, specs, verification records and decisions always travel with the code they describe.

Next: the reviewer-model slice (single human approver with Claude pre-checks, cooling-off, dispute window and audit), then staging wiring on the existing Supabase and Vercel projects. Staging wiring needs `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` in the cloud environment.

## Current checkpoint — Slice 6I camera QR scanner, 2026-09-26

Slice 6I is locally complete on `claude/handoff-review-72h2i9`, on `main` at `18e451f` plus the open close-out PR #99. The owner approved the spec, the native `expo-camera` dependency, removing the claimant paste field and adding `jsqr` for tests only.

The claim screen now scans the emergency sheet's QR code with the camera:
- camera permission only (no microphone), requested only after the claimant taps "Scan the QR code";
- QR codes only, one sheet per scan, with foreign or over-long codes ignored;
- the camera is unmounted as soon as a sheet is read, screen capture is blocked, and nothing is stored or logged.

In the normal app the handle is still null, so the route shows "unavailable" and the camera is never reached. An acceptance test decodes the QR image the owner actually prints and drives it through the real claim flow and routes to exactly one started claim. A new isolation check is wired into security CI. Scope: `docs/superpowers/specs/2026-09-26-claimant-slice-6i-camera-qr-scanner.md`; evidence: `docs/verification/2026-09-26-claimant-slice-6i-camera-qr-scanner.md`. It needs a new native build; physical-phone scanning evidence belongs to the first staging wiring phase.

**Reviewer decision (owner, 2026-09-26).** Shahbaz Malik is the only human who approves a claim release. Claude runs automated pre-checks that inform his decision but is never a reviewer or an approver of a real claim. One-human review is backed by a cooling-off period, a dispute window and a full audit trail, delivered as its own slice. This replaces the two-human-reviewer requirement from Slices 3E/3F.

**Owner direction (2026-09-26).** Offline-only slices stop after 6I and the "my emergency sheets" list. Work then moves to wiring the claimant side into a hosted test environment and on to production. The owner granted authorisation for hosting changes. Owner decision: reuse the existing Supabase and Vercel projects, with no separate staging projects. Claimant features are switched on only in Vercel's protected Preview environment, never in Production, and synthetic claimant data is cleared before go-live. Hosted work needs `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` in the cloud environment.

Next: the "my emergency sheets" list with revoke, the reviewer-model slice, then staging wiring.

## Current checkpoint — session close with Slices 6F–6H, 2026-09-25

The canonical close-out and next-session opener is `docs/handoff/2026-09-25-claimant-6f-6h-session-close.md`.

Merged this session:
- 6F through PR #95 (`a6e15b5`);
- 6G through PR #96 (`3c68b57`);
- 6H, plus the release-build `EXPO_PUBLIC_*` inlining fix, through PR #98 (`18e451f`).

The inlining fix restores the API URL, the RevenueCat keys and SSL pinning in release builds. The "locally complete" entries below for 6F, 6G and 6H are historical.

Next: 6I, the claimant camera QR scanner; or the reviewer decision; or a "my emergency sheets" list with revoke.

## Current checkpoint — Slice 6H owner emergency-sheet screen, 2026-09-25

Slice 6G merged through PR #96 at `3c68b57`. Slice 6H is locally complete on `claude/busy-franklin-xv1jah`. The owner approved the spec and all three decisions: add `qrcode-generator`, print only, and automatically revoke a sheet the owner has not confirmed.

The owner app can now:
1. generate a sheet through the vault session (the vault key never leaves it);
2. re-open the release wrap from the printed material alone to prove it holds that key;
3. register it through the 6G route, with a fresh-TOTP step-up that keeps the same idempotency key;
4. print a QR sheet with `expo-print` `printAsync` only, with no file and no share option;
5. drop the sheet from memory once the owner confirms the print.

An unconfirmed sheet is revoked when the owner leaves the screen, locks the vault, backgrounds the app, or when registration fails. Backgrounding is ignored while printing or waiting for the TOTP code. Two literal-false constants keep the entry hidden, and the route shows "unavailable". An acceptance test runs the real owner flow through the actual 6G route to a verified claimant proof, and shows a decoy after abandonment. A new isolation check is wired into security CI. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6h-owner-sheet-screen.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6h-owner-sheet-screen.md`.

Next slices:
- 6I, the claimant camera QR scanner;
- a "my emergency sheets" list with revoke, which needs an owner list route.

The reviewer decision stays open until before go-live.

## Current checkpoint — Slice 6G owner sheet registration route, 2026-09-25

Slice 6F merged through PR #95 at `a6e15b5`. Slice 6G, approved with revocation included, is locally complete on `claude/busy-franklin-xv1jah`. It adds two owner routes:
- `POST /owner/offline-code/v2/locators` registers a sheet;
- `POST /owner/offline-code/v2/locators/:locatorRecordId/revoke` revokes one.

Both are literal-false and gated by the `offlineCodeV2` capability, so the mounted app returns 404 for them. They need an exact owner origin and a fresh AAL2 owner session that is still active. The owner ID comes only from the session. Before calling the 5B function, the server recomputes the locator commitment and the record-binding digest with the session owner, so another owner's sheet is refused. The locator index now comes from one shared module that the claimant challenge route also uses. An acceptance test registers a real 6F sheet, finds it through the actual challenge route, verifies the claimant's proof, and shows a decoy after revocation. A new isolation check is wired into security CI. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6g-owner-registration-route.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6g-owner-registration-route.md`. Next slices: 6H owner sheet generation and printing screen, 6I claimant camera QR scanner. The reviewer decision stays open until before go-live.

## Current checkpoint — Slice 6F local owner sheet generator, 2026-09-25

Slice 6E merged through PR #94 at `1fcb816`. Slice 6F is locally complete on `claude/claimant-slice-6f-owner-sheet-generator`. It adds a literal-false, synthetic-only owner-side generator that creates the `SKQ2.` emergency-sheet payload, the printed locator and secret, and the exact inputs for the 5B locator-registration function. The owner's vault key is wrapped for release and never returned. With the vector's fixed bytes it reproduces the published synthetic vector byte for byte. Its sheet, fed to the claimant proof producer, yields the vector's exact possession proof. A new isolation check keeps it unmounted. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6f-owner-sheet-generator.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6f-owner-sheet-generator.md`. Next slices: 6G owner registration API route, 6H owner sheet generation and printing screen, 6I claimant camera QR scanner. The reviewer decision is still open.

## Current checkpoint — session close with Slice 6E, 2026-09-25

Canonical close-out and next-session opener: `docs/handoff/2026-09-25-claimant-6c-6e-session-close.md`. Owner decisions recorded there:
- a single launch with the claimant handover included;
- Shahbaz Malik as sole approver for code and launch, with legal review still sought for public documents;
- the offline-code emergency sheet carries a QR payload;
- an open choice between two human reviewers and a single reviewer with extra safeguards.

Slice 6E is locally complete on `claude/claimant-slice-6e-offline-code-screens`, stacked on 6D PR #93. It adds a strict `SKQ2.` sheet codec, a claim-flow controller, a narrow `claimFlowRuntime()` bootstrap handle (null in the normal app) and the first claimant screen, `app/claim/offline-code`, which always shows "unavailable" in the normal app. 1,591 workspace tests with three established skips, 294 script tests and all checks pass. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6e-offline-code-sheet-and-screen.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6e-offline-code-sheet-and-screen.md`. Merge #93 before 6E.

## Current checkpoint — Slice 6D local reconciliation acceptance, 2026-09-25

Slice 6C merged through PR #92 at `404945a`; its "locally complete" entry below is historical. Slice 6D is locally complete on `claude/claimant-slice-6d-reconciliation`. A test-only API suite runs the real mobile runtime chain against the actual portal-session, offline-code V2 and handoff routes, with only the database replaced by a store modelled on the cited migrations. It covers lost committed responses with exact retry, kill switch and background after a commit, restart after an ambiguous commit, stale-session displacement, reused-key conflicts and zero traffic after the kill switch. It found two defects, both fixed with regression tests. First, the 5T client rejected every revoke, because the SQL returns the advanced session version. Second, the 6A kill switch deferred disposal by one microtask, so one more request could reach the API. 1,560 workspace tests with three established skips, 294 script tests, typechecks, lint, security/audit, all 42 claimant isolation checks, Expo Doctor and the web build pass. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6d-reconciliation-acceptance.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6d-reconciliation-acceptance.md`. All controls stay false/false/engaged; no migration, hosted mutation, UI, deployment, real data or activation. Real-PostgreSQL race/RLS acceptance remains a separate Docker-based slice.

## Current checkpoint — Slice 6C local fault-injection acceptance, 2026-09-25

Slice 6C is locally complete on `claude/claimant-slice-6c-fault-injection`, based on `main` at `9012a75`. It is a test-only acceptance suite that drives the real 6A bootstrap → 5Z → 5U–5V → 5T/5S/5R chain and interrupts every in-flight stage with the kill switch, background/inactive, disposal, hosted-identity drift, outage and requests that never respond, plus race cases. Every case fails closed, generic and value-free; retries are revoked and every subscription is released. The suite found one defect: the 5T portal-session client never aborted an in-flight request on cancel or close, so the operation, and awaitable disposal, could hang. The fix aborts the active request; authority was never exposed. 1,544 workspace tests with three established skips, 296 script tests, typechecks, lint, security/audit and all 42 claimant isolation checks, Expo Doctor and the web build pass. Scope: `docs/superpowers/specs/2026-09-25-claimant-slice-6c-runtime-fault-injection-acceptance.md`; evidence: `docs/verification/2026-09-25-claimant-slice-6c-runtime-fault-injection-acceptance.md`. All controls stay false/false/engaged; no hosted mutation, UI, deployment, real data or activation. Server-side hostile/race/replay suites remain a later slice that needs the local Supabase stack.

## Current checkpoint — `image-size` exception retired, 2026-09-25

Slice 6B merged through PR #90 at `9012a75`. The temporary `image-size` exception (due 2026-09-30) is retired through PR #91 (merged at `f01e38c`): a scoped root override aligns `@react-native/community-cli-plugin`'s Metro packages on `0.84.5`, the exact version Expo 56 already pins and within the plugin's `^0.84.3` range. Metro 0.84.5 reads image dimensions internally, so `image-size` is no longer installed. The parser patch, its hostile-buffer test and the audit allowlist/digest/deadline logic are removed; the production audit now fails on every high or critical advisory and currently reports none. See `docs/dependency-security-exceptions.md`. This is a dependency-only change: no claimant control, runtime wiring, hosted state, deployment or activation changed. Slice 6C is next and must be specified and authorized before coding.

## Current checkpoint — Slice 6B local bundled launch policy, 2026-09-25

Slice 6A is merged through PR #89 at `0698623` with exact-head gates green and ancestry verified. Slice 6B is locally complete on `codex/claimant-runtime-launch-policy`: a versioned bundled-only policy makes the normal app's runtime posture explicit—approval false, feature false, kill switch engaged—then supplies those controls to the existing 6A bootstrap. The policy accepts no input, imports no adapter and exposes only a frozen value-free synthetic/non-production posture with identity and release authority false. Full tests, typechecks, lint, security/audit/isolation, Expo Doctor, API bundle and web build pass. See `docs/superpowers/specs/2026-09-25-claimant-slice-6b-runtime-launch-policy.md` and `docs/verification/2026-09-25-claimant-slice-6b-runtime-launch-policy.md`. Hosted Auth/MFA, claimant UI, production signer/custody, providers, persistence, deployment, real data and activation remain outside scope and unauthorized.

## Current checkpoint — Slice 6A local disabled runtime bootstrap, 2026-09-25

PRs #87 and #88 are merged with their required exact-head gates green; `main` includes combined Slices 5W–5Z at merge commits `805757bd` and `e38a544`. Slice 6A is locally complete on `codex/claimant-runtime-bootstrap`. A separately literal-false bootstrap adds independent feature-disable and kill-switch controls around the 5X–5Z foundation; only the mobile root imports it, and normal startup returns inertly before reading injected runtime dependencies. Application background/inactive state and unmount close idempotently, snapshots remain frozen and value-free, and no claimant business operation is exposed. Full local tests, typechecks, lint, security/audit/isolation, Expo Doctor, API bundle and web build pass. See `docs/superpowers/specs/2026-09-25-claimant-slice-6a-runtime-bootstrap.md` and `docs/verification/2026-09-25-claimant-slice-6a-runtime-bootstrap.md`. Hosted Auth/MFA, claimant UI, production signer/custody, providers, persistence, deployment, real data and activation remain outside scope and unauthorized.

## Current checkpoint — combined Slices 5X–5Z local runtime foundations, 2026-09-15

Combined Slices 5X–5Z are locally complete on `codex/claimant-runtime-foundations`, stacked on Slice 5W head `f352c9a`. The isolated, independently literal-false root composes an injected exact-issuer/audience fresh-AAL2 synthetic identity source and an injected native-shaped signer with verified user presence and non-exportable test-key custody into the existing claimant journey. It remains unmounted and value-free, with no Supabase/native/provider production import, UI, persistence, hosted mutation, deployment, real data or activation. Local evidence is 33 focused tests, 1,462 workspace tests plus three established skips, 288 serial script tests and green typecheck/lint/security/isolation/build gates. See `docs/superpowers/specs/2026-09-15-claimant-slices-5x-5z-runtime-foundations.md` and `docs/verification/2026-09-15-claimant-slices-5x-5z-runtime-foundations.md`. Delivery requires a dedicated exact-head watcher; green permits progression, red permits narrow repair and resubmission, and neither state authorizes automatic merge or another slice.

## Current checkpoint — Slice 5W local acceptance, 2026-09-15

Slice 5W is published in PR #87 from `codex/claimant-whole-journey-acceptance`; first code/evidence head `dcc027f`. Its separately guarded literal-false harness composes the merged 5U–5V synthetic session/possession path with the existing shared synthetic submission/state model through closure, while the seam and final report remain value-free. Eleven focused tests, all 1,429 workspace tests with three established skips, 285 serial script tests, typechecks, zero-warning lint, security/isolation, API bundle and the 24-page web build pass. See `docs/superpowers/specs/2026-09-15-claimant-slice-5w-whole-journey-acceptance.md` and `docs/verification/2026-09-15-claimant-slice-5w-whole-journey-acceptance.md`. The active `pr-87-slice-5w-green-red-watcher` handles exact-head CI, previews and logs, narrow repair/resubmission on confirmed red, and conclusive green reporting without merging or starting another slice. This does not authorize hosted MFA/Auth, normal UI/runtime wiring, production native custody/signing, providers, deployment, real data, downstream runtime authority or activation.

## Current checkpoint and opener — Slices 5S–5V merged, 2026-09-15

This is the authoritative resume point; the same-day local/stacked/watcher sections below are historical. PR #84 merged Slice 5S at `281e8c06bd58077f9fbc6c1a635c65afbf990b4e` from exact head `73c34e624555576e27c7afedfc1fe9b447e82989`. PR #85 merged Slice 5T plus the ordered Android recovery-slot repair at `be39979fe73553a91c1cedfb4e178e37fc660229` from exact head `10a2995e083010d8651a89245205105f22d1c9e4`. PR #86 merged combined Slices 5U–5V at `0a1f29c548c7fa4076e5fa5ed2288530599856e6` from exact head `8c6d90b1caa581ad8432bb85a1a085fefb462377`. All three exact heads are on `origin/main`; all required CI/security/native/hosted/Vercel gates completed green, and the watcher has been deleted.

The result is still a synthetic-only, independently literal-false, runtime-disconnected claimant journey composition. It does not add normal app UI/navigation, hosted MFA/Auth, persistent sessions, production native custody/signing, provider adapters, deployment, real data, intake/review/release authority or external claimant access. Begin the next session with [the 2026-09-15 closeout](docs/handoff/2026-09-15-claimant-5s-5v-session-close.md), this file and the 5S/5T/5U–5V specs and verification records. No next slice has been authorized. The recommended candidate is a separately specified synthetic whole-journey acceptance slice (provisionally 5W) that composes only injected/local test boundaries and preserves every prohibition; confirm its acceptance cases and authorization before coding.

## Current checkpoint — combined Slices 5U–5V local composition, 2026-09-15

Combined Slices 5U–5V are published in stacked PR #86 from `codex/claimant-session-journey-composition`, targeting repaired Slice 5T PR #85. The independently literal-false mobile controller binds one injected synthetic authenticated session and ordered lifecycle, activates the 5T claimant-portal session client, constructs 5S only after activation, freshly asserts the exact server session before bridge work/retries, and returns only the frozen value-free draft. Fourteen new journey tests, all 1,418 workspace tests with three established skips, 282 serial script tests, all typechecks, zero-warning lint, security/audit/isolation, API bundle and the 24-page web build pass. No hosted MFA/Auth, normal runtime importer, UI/navigation, persistence, native custody/signing, deployment, real data or downstream authority was added. Scope: `docs/superpowers/specs/2026-09-15-claimant-slice-5u-5v-session-journey-composition.md`; evidence: `docs/verification/2026-09-15-claimant-slice-5u-5v-session-journey-composition.md`. PR #84 is merged. The active sequential watcher owns repaired #85 delivery, then #86 retargeting and complete exact-head gating.

## Current checkpoint — Slice 5T local client, 2026-09-15

Slice 5T is published in stacked PR #85 from `codex/claimant-portal-session-client` at first head `c27945b`, targeting Slice 5S PR #84. The independently literal-false mobile client adds injected claimant-portal activate/assert/revoke HTTP transport, strict safe response handling, exact session-version continuity, a memory-only synthetic session source, bounded ambiguous activation/revoke retry and cancellation/disposal suppression. Ten new behavior tests, all 1,404 workspace tests with three established skips, 275 serial script tests, typechecks, lint, security/audit/isolation, API bundle and the 24-page web build pass. No Supabase SDK, hosted MFA/Auth, normal runtime importer, lifecycle/5S wiring, persistence, native custody/signing, deployment, real data or downstream authority was added. Scope: `docs/superpowers/specs/2026-09-15-claimant-slice-5t-portal-session-client.md`; evidence: `docs/verification/2026-09-15-claimant-slice-5t-portal-session-client.md`. The active `pr-84-85-claimant-green-merge` watcher delivers #84 first, then retargets, gates and merges #85 without deployment or activation.

## Current checkpoint — Slice 5S local composition, 2026-09-15

Slice 5S is published in stacked PR #84 from `codex/claimant-session-bridge-composition`, targeting open documentation-only PR #83. Its first head is `ed1b95d`. The new independently literal-false mobile harness synchronously binds one injected synthetic fresh-AAL2 claimant-portal session to the 5R possession/handoff bridge, fans out one ordered lifecycle, invalidates session drift/background/cancellation and exposes only a value-free draft summary. Eleven new behavior tests, all 1,394 workspace tests with three established skips, 272 serial script tests, typechecks, lint, security/audit/isolation, API bundle and the 24-page web build pass. No normal runtime importer, hosted MFA/Auth, native custody/signing, persistence, UI, deployment, real data or downstream authority was added. Scope: `docs/superpowers/specs/2026-09-15-claimant-slice-5s-session-bridge-composition.md`; evidence: `docs/verification/2026-09-15-claimant-slice-5s-session-bridge-composition.md`. The active ten-minute `pr-83-84-claimant-5s-gates` watcher reports exact-head CI/preview green or actionable red without merging or deployment. Do not treat local green as CI or activation evidence.

## Current checkpoint — 5Q and 5R merged, 2026-09-13

Slices 5Q and 5R are merged into `main` through PRs [#79](https://github.com/shahbaz242630/Document-Vault/pull/79) and [#80](https://github.com/shahbaz242630/Document-Vault/pull/80). Final `main` CI and Vercel checks passed at `85223a3`; protected-preview application smoke passed on both exact PR heads. The old open-PR, watcher and SSO-blocked checkpoints below are historical. No watcher remains for these PRs. The claimant journey is still disabled and incomplete. Read the [session closeout](docs/handoff/2026-09-13-claimant-5q-5r-session-close.md) for evidence, remaining work and the next-session opener.

## Current checkpoint — Slice 5R local bridge, 2026-09-13

Owner-authorized Slice 5R is published in stacked PR #80 from `codex/claimant-v2-possession-handoff-bridge`, based on the still-open Slice 5Q PR #79 head `386482f`. It composes the disabled synthetic offline-code V2 possession and authenticated handoff lifecycles. The server-validated proof supplies the source challenge and binding digest; the bridge enforces claimant session continuity and shared lifecycle invalidation. See the [5R spec](docs/superpowers/specs/2026-09-13-claimant-slice-5r-possession-handoff-bridge.md) and [verification](docs/verification/2026-09-13-claimant-slice-5r-possession-handoff-bridge.md). The active `pr-79-80-claimant-gates` watcher reports actionable exact-head CI green/red for both PRs and continues PR #79's protected-preview staging smoke. PR #79 CI is green, but SSO still prevents the required application-level staging smoke; neither PR is merged or staging-verified. Keep approvals false and all data synthetic; preserve `.codex-runtime/` and `.playwright-cli/` without inspection or staging.

## Current checkpoint — Slice 5Q lifecycle, 2026-09-13

PR #73 merged Slice 5P at `b6cd577` on 2026-09-09. Slice 5Q is published in PR #79 from `codex/claimant-handoff-lifecycle`: a separate, synthetic-only, literal-false foreground lifecycle wrapper for the 5P mobile handoff. It cancels and clears retry on background/inactive, closes on lock/session end/disable or hostile event ordering, discards late results and supports awaitable disposal. The local dependency-audit repair and Docker-backed handoff acceptance pass. The active `pr-79-handoff-lifecycle-gates` watcher reports actionable exact-head CI/staging green or red, without merging. See the 5Q spec and verification record. The prior 5P staging note is preserved; it does not establish handoff-route concealment/hostile-origin smoke before the merge.

The complete claimant journey is still not runtime-wired. Hosted MFA, production native custody/signing, UI/session composition, provider adapters and whole-journey acceptance remain open. Keep capabilities false and synthetic data only. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection or staging. No further slice follows automatically.

Last updated: 2026-09-15 (Asia/Dubai)

## Current checkpoint and opener — Slice 5P client, 2026-09-05

This checkpoint supersedes all older "current" openers, branch snapshots and watcher instructions below. PR #71 merged at `201f079`; PR #72 merged Slice 5O at `96e41e0`. Do not repeat their staging or merge work.

Owner-authorized Slice 5P is implemented locally on `codex/claimant-offline-code-v2-handoff-client`, from `96e41e0`: a separate disabled mobile handoff transport and coordinator, strict account/session/source/domain transcript binding, exact opaque-byte injected synthetic signing, allowlisted draft result and bounded identical completion retries. Production native signing, lifecycle/UI composition and activation remain out of scope.

Read `docs/superpowers/specs/2026-09-05-claimant-slice-5p-handoff-client.md` and `docs/verification/2026-09-05-claimant-slice-5p-handoff-client.md`. Finish local verification and publish the code slice together with preserved handoff edits. Use the existing matching watcher if present; otherwise create one for this PR. The owner requests watcher-reported green/red for PR gates, staging and logs. Green permits the next delivery step; red requires a focused fix followed by watcher re-evaluation. Pending checks and inaccessible protected staging are not green. Preserve merge-commit/branch-retention practice and verify ancestry after merge. No next slice is selected or authorized automatically.

Keep all approvals literal false and use synthetic data only. No hosted mutations, production deployment/promotion, native/EAS build, production signer, real claimant data or expansion of identity/intake/review/release authority. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection, modification, deletion or staging. Earlier token-rotation follow-up is unconfirmed; never retrieve or reproduce that token.

## Latest checkpoint — PR #71 green; protected staging smoke blocked, 2026-09-04

- Slice 5N is published in PR #71 from `codex/claimant-offline-code-v2-case-binding`; current head is `aff02b7d3013e19cb9f983a50733d3018d245850`. The PR is open, mergeable, and GitHub reports `CLEAN`.
- Two watcher repairs were pushed: `daba9ee` stabilizes the cross-platform offline-code transport typing, and `aff02b7` removes the unused handoff database-test variable. Proportional local typecheck, focused test, lint, Phase 1, and security checks passed before each push.
- Every required GitHub/Vercel gate is now successful or intentionally skipped: app security, CodeQL, OWASP ZAP, Android compile/emulator, iOS simulator, live Supabase security/integration, GitGuardian, and both Vercel projects. The ZAP gate's first attempt failed before producing a report despite a healthy API; one evidence-based retry of the same pinned scanner passed.
- Both `sanduqkin-api` and `sanduqkin-web` preview deployments are Ready. Vercel Authentication correctly returns `302` to SSO with `X-Robots-Tag: noindex` for `/health`, hostile claimant paths, and the web root. Because no `VERCEL_AUTOMATION_BYPASS_SECRET` is available, application-level health, concealment, web, and runtime-log staging verification is incomplete. Do not merge until that smoke test passes through an existing or separately authorized bypass; do not weaken preview protection.
- The ten-minute heartbeat `pr-71-green-staging-merge-watcher` remains ACTIVE. It is authorized to complete staging, merge PR #71 with a merge commit without deleting the branch, verify the PR head is an ancestor of `origin/main`, report the result, and delete itself. It must remain paused while staging is inaccessible.
- Main branch protection now requires strict/up-to-date app security, CodeQL, ZAP, Android compile, iOS smoke, and both Vercel gates; admin enforcement, resolved conversations, and force-push/deletion protection are enabled. GitHub production environments for the API and web require the owner reviewer and protected branches. Solo-repository approvals remain zero to avoid deadlocking owner-authored PRs; GitHub still reports that administrators can bypass environment protection.
- Slice 5N remains synthetic-only, literal-false, and unmounted. No hosted Supabase mutation, production promotion/deployment, native/EAS build, real claimant data, or capability activation occurred. Canonical closeout and copyable opener: `docs/handoff/2026-09-04-slice-5n-session-close.md`. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection or staging.


## Latest checkpoint — session close, 2026-09-03

This checkpoint and the current opener in `CLAIM_HANDOFF.md` supersede all older branch/PR snapshots and historical resume prompts below.

- Local Slice 5M branch: `codex/claimant-offline-code-v2-case-binding`, scaffold `af2fce3`, hardening `20b0d89`, verification/handoff checkpoint `f81516d`. 5M is implemented, literal-false, unmounted, and unpushed. Preserve these checkpoints; do not rebuild completed 5I-5M work.
- Previous 5M verification passed: hostile SQL/RLS, a genuine two-session race with one winner, 5L database acceptance, 1,265 workspace tests plus 3 established skips, all typechecks/lint/security/phase guards, and 78 serial script-test files. This is local evidence, not merged-baseline closeout.
- PR #68 is separate on `codex/claimant-offline-code-v2-controller` in `C:\Projects\GitHub\Sandoq Kin-pr68-watch`. Repair `88e88de` was pushed after `ff40766` and `6d47a23`. It fixes complete retrieval/delivery fixtures and the persistence test's obsolete RPC signatures, and adds CI fixture regressions; it changes no production grants, migrations, or flags.
- Last GitHub observation at session close (2026-09-03 around 11:05 Asia/Dubai): PR #68 OPEN, not merged, head `88e88de`. App security, CodeQL, ZAP, and GitGuardian passed; native and Supabase live gates were in progress. Refresh the latest head/checks before acting; this is not an all-green claim.
- PR repair verification passed on a clean PR-only local database: all nine downstream live DB gates, 236 serial script tests, standalone persistence, RLS attacks, catalog security, and security advisors. Source lint passed excluding only generated `supabase/.temp/**`; no lint config was weakened.
- IMPORTANT local state: `supabase_db_sanduqkin` was reset from the PR worktree for that repair. It currently has the PR-only schema, NOT the 5M migration. Docker availability must be rechecked; do not treat this database as the verified combined baseline.
- The existing ten-minute `watch-pr-68-checks` heartbeat remains ACTIVE and unchanged. It reports meaningful failures; after required checks pass and mergeability is confirmed, it merges, confirms the result, queues one baseline-first continuation in task `01a0623a-edeb-7c03-8ab0-0262693bcffd`, then deletes itself. Check for an already queued/running continuation; do not duplicate the watcher or work.
- Slice 5N (authenticated possession-to-case handoff) is conditionally authorized only AFTER PR #68 passes/merges AND safe integration plus clean 5L/5M acceptance/regressions pass. Bind possession to the exact authenticated claimant and active AAL2 session, short expiry, single use, safe retries, and server-derived authority. A public challenge ID alone is never authorization.
- Full closeout and copyable opener: `docs/handoff/2026-09-03-session-close.md`. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection. No 5M/5N push/publication, hosted mutation, deployment, new native/EAS build, real claimant data, capability activation, or subagents are authorized.

## Current Owner Decision

The claimant programme is now `GO` for engineering implementation and production-readiness work, but remains `NO-GO` for external access, real claimant data, production activation, or release.

Build, wire, integrate, and test the complete claimant journey before waiting for governance, compliance, staffing, or specialist launch approval. Engineering must use synthetic identities and documents, production-shaped local/test infrastructure, disabled-by-default capabilities, and independently operable kill switches. Governance and administrative closure are launch gates, not reasons to leave the product unbuilt.

Owner decision on 2026-08-04: hosted claimant Supabase MFA client work is parked while the project remains on the Free plan. Do not weaken or remove the existing fresh-AAL2 API/database enforcement. Continue later slices with synthetic verified AAL2 sessions and disabled runtime; Supabase plan approval plus hosted MFA enrollment/challenge/recovery and production-shaped verification are mandatory before external claimant access or final readiness sign-off.

This decision authorizes small, reviewed claimant code slices covering both intended routes:

1. Registered next of kin / registered recipient first.
2. The safe V2 offline-code route second.

It does not authorize the unsafe V1 code as a public claim locator. It also does not authorize provider accounts, DNS, hosting, production environment changes, deployment, TestFlight work, public App Store release, real notifications, real evidence, or real claimant data.

Interim reviewer decision on 2026-08-18: Shahbaz Malik is the accountable human test reviewer and Codex is the non-human technical review assistant/test actor for synthetic local/staging and separately authorized disabled production-shaped verification. Codex may simulate a second reviewer path for hostile testing but cannot satisfy a human approval, hold production credentials, review real evidence, authorize release, or count as independent assurance. Two qualified independent human reviewers remain mandatory before real claimant data or go-live. See `docs/verification/2026-08-18-interim-reviewer-test-roles.md`.

## Historical Session Close — 2026-09-02 (superseded)

- Slice 5L is complete locally at `03570ca` on `codex/claimant-offline-code-v2-database-acceptance`, following scaffold `4b32214` and refactor `2be9d71`. It replaces Slice 5K's final persistence double with disposable local Supabase PostgREST/RPC acceptance while retaining the actual mobile, Hono, verifier, and decoder paths.
- The real local database run passed registration, mobile possession, committed-response retry, concurrent registration, expiry, unknown-locator limiting, anonymous RLS denial, and possession-only output. Closing evidence: 1,258 workspace tests passed with 3 established mobile skips; 236 static/security tests, 30 focused integration scenarios, 2 Slice 5L guards, all typechecks, zero-warning lint, phase/security checks, and database acceptance passed. See `docs/verification/2026-09-02-claimant-slice-5l-offline-code-v2-database-acceptance.md`.
- The disposable database required the exact replay-safe `20260819091516_harden_rls_auto_enable_execution.sql` repair already present on PR #68 because this local branch predates that PR. It was applied only to the disposable database, not duplicated into Slice 5L. Rerun 5L from the clean combined baseline after PR #68 merges and is integrated.
- PR #68 remains open at `18c6df6`. Its previous red live-security gate was repaired with explicit fully migrated release-authorization fixture columns. Fresh checks are running; GitGuardian is green. The watcher will report a meaningful red or merge when required checks are green and the PR is mergeable.
- All runtime approvals remain false. No hosted mutation, deployment, native/EAS build, real claimant data, external activation, or production authorization occurred. `.codex-runtime/` and `.playwright-cli/` remain untouched. Docker Desktop became unavailable during cleanup; no local Supabase endpoint is reachable, but its disposable volume may require `supabase stop --workdir supabase --no-backup` after Docker restarts.

### Copyable next-session prompt

> Read CLAIM_HANDOFF.md first, then HANDOFF.md, SECURITY_HANDOFF.md, MVP_HANDOFF.md, and the Slice 5L verification record. Resume `codex/claimant-offline-code-v2-database-acceptance` at `03570ca`, preserving unrelated `.codex-runtime/` and `.playwright-cli/`. First inspect the PR #68 watcher outcome. If PR #68 merged, integrate the new main baseline safely and rerun Slice 5L database acceptance from a clean disposable Supabase stack; do not duplicate its migration repairs. If it is red, inspect and fix only the failing gate. Slice 5L is otherwise complete. The recommended next bounded slice is 5M post-possession case binding, but it is not authorized or started. Keep every runtime approval false; do not deploy, mutate hosted services, build native apps, or use real claimant data without separate authorization.

## Historical Session Close — 2026-08-31 (superseded)

- Completed Slice 5I transport/coordinator at `60a8601`, Slice 5J lifecycle composition at `5b0fcdb`, and Slice 5K mobile/API integration acceptance at `1bc43c4`. Current branch: `codex/claimant-offline-code-v2-integration-acceptance`.
- Slice 5K adds 30 scenarios using the actual mobile crypto/transport/lifecycle, API controllers/verifier, and transaction decoder with synthetic RPC responses. Success, ambiguous response retries, cancellation, hostile input, and malformed output are covered. No production implementation changed in 5K.
- Closing checks: 1,258 workspace tests passed, 3 established mobile skips; 234 static/security tests passed. All workspace typechecks, zero-warning lint, web build (24 static pages), API bundle, deterministic vectors, custody, and isolation checks passed. Focused rerun: `npm run check:claimant-offline-code-v2-integration`.
- Code, slice specification, verification evidence, and the initial handoff update are committed in `1bc43c4`. This subsequent session-close update changes only the four handoffs and remains local and uncommitted for bundling with the next authorized code slice. Do not discard it as unexpected drift.
- No push, PR publication, hosted mutation, deployment, native/EAS build, real claimant data, or capability activation occurred. All runtime approvals remain false. The synthetic RPC double is not SQL/RLS/transaction or physical-device evidence.
- PR #68 and watcher status below are the last Slice 5K observations, not a fresh session-close inspection. Local Slices 5F-5K remain unpushed; the watcher file was absent and monitoring unconfirmed. Preserve unrelated `.codex-runtime/` and `.playwright-cli/` without inspecting their contents.

### Copyable next-session prompt

> Read CLAIM_HANDOFF.md first, then the other three handoffs and the Slice 5K verification record. Resume branch codex/claimant-offline-code-v2-integration-acceptance at commit 1bc43c4, preserving the uncommitted handoff-only session-close updates and unrelated local directories. Slices 5I-5K are complete; do not rebuild them. Confirm the repository state, review the remaining engineering gaps, and identify the next bounded synthetic slice and its acceptance criteria. No next slice has been selected or started yet. Refresh PR #68 and verify the watcher before relying on delivery status. Keep every runtime approval false; do not push, deploy, mutate hosted services, build native apps, or use real claimant data without separate authorization.

## Next Session Opener — current

1. Read the latest checkpoint, all four handoffs, `docs/handoff/2026-09-04-slice-5n-session-close.md`, and the Slice 5N verification record. Historical resume prompts are not current instructions.
2. Inspect Git status on `codex/claimant-offline-code-v2-case-binding` and preserve the current handoff edits. Preserve `.codex-runtime/` and `.playwright-cli/` without inspection, modification, deletion, or staging.
3. Refresh PR #71 and confirm its head before acting. At close it was open, mergeable/`CLEAN`, fully green, and at `aff02b7d3013e19cb9f983a50733d3018d245850`; both Vercel previews were Ready.
4. Confirm the ten-minute `pr-71-green-staging-merge-watcher` is active. Do not duplicate it. If any fresh gate is red, diagnose and repair only that gate without weakening it.
5. Finish the required staging smoke through an existing authorized Vercel automation bypass: API `/health`, hostile/unauthorized offline-code V2 and authenticated-handoff route concealment and origin handling, safe web response, and relevant exception logs. No bypass was available at close. Do not create a persistent bypass or weaken SSO protection without explicit authorization; if still blocked, report it and do not merge.
6. After staging passes, merge PR #71 with a merge commit without deleting the branch, fetch `origin/main`, and verify the exact PR head is an ancestor. Report the result and delete the watcher.
7. Keep all claimant approvals literal-false and routes unmounted. No hosted Supabase/Auth/Storage mutation, production promotion/deployment, native/EAS build, real claimant data, capability activation, or expansion into identity/intake/review/release.
8. No next engineering slice is selected or authorized. The earlier exposed-token rotation follow-up remains unconfirmed; never retrieve or reproduce the token.

### Copyable next-session prompt — current

> Partner, read CLAIM_HANDOFF.md first, then HANDOFF.md, SECURITY_HANDOFF.md, MVP_HANDOFF.md, docs/handoff/2026-09-04-slice-5n-session-close.md, and the Slice 5N verification record. Resume `codex/claimant-offline-code-v2-case-binding` and preserve the local handoff edits plus `.codex-runtime/` and `.playwright-cli/` without inspecting those protected directories. Refresh PR #71 and confirm the active watcher; at close, head `aff02b7d3013e19cb9f983a50733d3018d245850` was fully green, mergeable, and both Vercel previews were Ready. The only blocker was Vercel SSO preventing the required application-level staging smoke, with no automation-bypass credential available. Use an existing authorized bypass if available—do not create one or weaken protection without explicit approval—then verify API health, hostile route concealment/origins, the web preview, and exception logs. If staging passes, merge with a merge commit without deleting the branch, fetch `origin/main`, verify ancestry, report completion, and delete the watcher. If still blocked, do not merge. Do not start a new slice or mutate hosted Supabase/Auth/Storage, promote production, build native/EAS artifacts, use real claimant data, activate capabilities, or expand authority.

### Phase 2 Slice 1A Exit Gate

- A pre-provisioned eligible synthetic claimant can sign in, complete approved MFA, activate exactly one context-bound server-owned claimant-portal session, reload safely, and sign out without entering an invitation or creating cryptographic key material.
- Valid but ineligible, owner-only, arbitrary, and ambiguous dual-role identities fail closed before claimant-portal session activation; a Supabase identity or AAL2 claim alone grants no claimant role.
- AAL1, recovery-only, stale, expired, malformed, displaced, and revoked sessions fail closed with safe copy and no sensitive error detail.
- Owner-vault, owner claimant-administration, and claimant-portal modes share no repositories, decrypted state, key aliases, navigation authority, or implicit role inheritance; session displacement behavior is explicit per context.
- Protected claimant routes are available only on the claimant test hostname, return private/`no-store`/`noindex` responses, and fail closed on public and owner hosts. Public claimant information routes remain unchanged and cannot call protected claimant APIs.
- Browser storage/cache inspection finds no private key, MEK/plaintext, invitation secret, evidence content, or release material.
- A value-free Phase 1 baseline manifest identifies the working-tree fingerprint, migration order/history, exact commands/results, and successful clean replay in a disposable local stack without altering the verified container.
- Focused web/API/browser tests and the full Phase 1 regression baseline pass before Slice 1A is recorded complete.

## Current Verified State

- Slice 5L is complete locally at `03570ca` on `codex/claimant-offline-code-v2-database-acceptance`. Disposable local Supabase/PostgREST/RPC acceptance now covers the actual registration and mobile possession path through PostgreSQL, including retry, concurrency, expiry, limiter, RLS denial, and possession-only outputs. All approvals remain false. See `docs/verification/2026-09-02-claimant-slice-5l-offline-code-v2-database-acceptance.md`.

- Slice 5K is complete at local commit `1bc43c4` (`Add offline-code V2 mobile API acceptance`) on `codex/claimant-offline-code-v2-integration-acceptance`, based on Slice 5J `5b0fcdb`. Thirty synthetic in-process acceptance scenarios connect the actual mobile proof flow to the actual Hono controllers, server verifier, and transaction decoder, replacing only the database RPC. Lost-response retries, lifecycle cancellation after server acceptance, hostile bindings, and fail-closed output are covered. All existing runtime approvals remain literal false; no production implementation or native binding changed. This does not establish SQL/RLS, hosted, or physical-device correctness. Verification: 1,258 workspace tests passed (3 established skips), 234 static/security tests; see `docs/verification/2026-08-31-claimant-slice-5k-offline-code-v2-integration-acceptance.md`.

- Slice 5J is code-complete locally on `codex/claimant-offline-code-v2-mobile-lifecycle`, based on Slice 5I `60a8601`. Its independently literal-false lifecycle root composes the injected proof flow, cancels and clears retry state on background/inactive events, closes permanently on lock/session-end/kill-switch, rejects stale completions, and provides awaitable disposal with value-free snapshots. No normal runtime or native binding is added. Verification: 1,228 workspace tests passed (3 established skips), 234 static/security tests; see `docs/verification/2026-08-31-claimant-slice-5j-offline-code-v2-mobile-lifecycle.md` for closing evidence.

- Slice 5I is code-complete locally on `codex/claimant-offline-code-v2-mobile-coordinator`, based on Slice 5H `f8dce80`. The injected transport and mobile coordinator remain independently literal-false and runtime-disconnected; they validate the frozen synthetic KDF/challenge/proof bindings, support bounded identical public-proof retries, and return possession-only authority. No normal runtime, native binding, hosted state, build, deployment, or external activation changed. Verification: 1,195 workspace tests passed (3 established environment-gated skips), 231 static/security tests, all typechecks/lint/builds and isolation checks. Evidence: `docs/verification/2026-08-31-claimant-slice-5i-offline-code-v2-mobile-coordinator.md`.

- PR #65, `Add hard-disabled claimant enrollment foundation`, merged Slices 1D-1H and the review closure/remediation at `dcd6fefee4c527a4e0eceff54fed59e1f240f746`. Its final protected matrix passed. No claimant deployment, hosted migration, TestFlight action, or production activation was performed.
- PR #65 also aligns Expo SDK dependencies, uses Expo's supported native-module export, upgrades remediable production dependencies, and applies a digest-verified `image-size` parser hardening patch. The temporary exception permits only `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`, fails closed for new advisories or patch drift, and expires after 2026-09-30. Retired on 2026-09-25 (Metro 0.84.5 drops `image-size`); see `docs/dependency-security-exceptions.md`.
- PR #54 merged the closed synthetic claimant baseline at `aa84031be93b460c9addada6d2fb3b09286595de`.
- The original reviewed claimant implementation is `a21830487f38c1d6ee3771780be454da6f20b982`; its acceptance-record head is `8ce2b675cfe50d097049fb08d869d86a97da59ba`.
- Synthetic Slices 1-17 provide contracts, validation, deterministic vectors, projections, fixtures, read-only previews, audit modelling, scenario execution, and an end-to-end synthetic acceptance suite.
- All public `/claim` routes remain informational or deterministic engineering previews. Claimant authentication, persistence, uploads, notifications, review operations, release, retrieval, and decryption are not currently wired as a complete runtime journey.
- Claimant web capability flags and `CLAIMANT_CUSTODY_PROBE_ENABLED` remain false.
- Sanduqkin `1.0.0` Build 7 was produced from `90291df0a77a707dc27bee4a4c17ba8c0b01f1ac`; EAS build `0d8fce13-9ec8-46c9-a4de-6c9224523856`.
- On 2026-08-04, Shahbaz Malik reported successful Apple processing, approval of the App Store Connect export-compliance answer, and a complete passing value-free physical-iPhone regression. The controlled internal TestFlight mobile gate is `PASS`; public release remains separately gated.
- The existing owner-vault Hono API/processor is deployed at `https://sanduqkin-api.vercel.app` in Vercel `fra1`. It has no claimant runtime. Any claimant deployment or expanded external use remains separately gated and must be included in `EDGE-01`.
- The 2026-08-04 code-readiness audit is recorded in `docs/superpowers/specs/2026-08-04-claimant-code-readiness-gap-matrix.md`. Phase 0 Slice 1 adds a canonical API startup-validated claimant capability graph with a master shutdown, independent kill switches, fail-closed dependency propagation, strict flag parsing, and an absolute production activation lock. No claimant route is mounted.
- Phase 0 Slice 1 verification: 39 API tests passed, API typecheck passed, focused ESLint passed, claimant vector and custody isolation passed, and the repository security guard passed.
- Phase 1 Slice 1 adds the default-deny registered-recipient database foundation: claimant identities, expiring single-use invitations with address digests only, public device keys that reject private JWK material, and cases bound to the accepted invitation/owner/claimant/key tuple. Forced RLS, explicit deny-all client policies, zero client grants, catalog enforcement, live invariant tests, and hostile REST tests pass. No claimant endpoint is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 2 adds service-only idempotency, append-only audit, value-free outbox, and transactional invitation issue/accept functions. Replay, changed-input, stale-version, digest mismatch, self-acceptance, private-key, and partial-failure paths are tested in rollback-only local transactions; anonymous and authenticated RPC access is blocked. No claimant endpoint is mounted and hosted Supabase is unchanged.
- Phase 1 Slice 3 mounts a disabled-by-default protected API boundary for those mutations. It verifies Supabase bearer sessions, derives owner/claimant actors server-side, enforces exact allowlisted origin/CORS/content-type/idempotency/body and strict request/response schemas, and redacts database failures. All 49 API tests pass; the endpoints remain concealed while disabled and no external runtime or hosted Supabase state changed.
- Phase 1 Slice 4 adds fresh AAL2 enforcement and server-owned session activation, displacement, assertion, and revocation. Nine claimant tables and five claimant/session RPCs remain client-inaccessible; recovery/AAL1/stale/expired/future/unknown assurance and displaced/revoked sessions fail closed. All 62 API and 61 static security tests pass; hosted Supabase and external runtime remain unchanged.
- Phase 1 Slice 5 completes the registered-recipient platform API: case-scoped second-device enrollment, replacement/revocation, pending-invitation revocation, two-key V2 ciphertext-grant finalization, and automatic invalidation/re-finalization after key change. Eleven tables remain default-deny; all 68 API and 64 static security tests pass. No client UI, hosted migration, or external runtime was activated.
- Phase 2 Slice 1A boundary sub-slice adds three more default-deny tables for synthetic portal eligibility, claimant-portal-specific session control, and append-only value-free portal session events. Three service-only functions enforce eligibility before context-bound activation/assertion/revocation. Protected `/claimant/**` routes are concealed unless a non-production web capability and exact claimant hostname are both approved; public `/claim/**` remains unchanged. The API has 73 passing tests, the static security set has 67, focused host/config/header/page tests pass, live catalog/RLS/portal database checks pass, and all workspace typechecks/lint pass. The full client sign-in/MFA flow and clean disposable-stack replay remain incomplete. Evidence: `docs/verification/2026-08-04-claimant-portal-session-boundary.md`.
- Phase 2 Slice 1B contract increment defines strict iOS Secure Enclave native enrollment capability, public-key challenge request, server challenge, and possession-proof bindings. Runtime validators reject Android/software custody, private material, raw/client-asserted address or identity/role/eligibility/acceptance fields, and altered cross-object bindings. Shared, mobile, web, and API consume one deterministic fixture with all runtime flags false; 113 shared, 409 mobile, 149 web, and 74 API tests pass. No live route, database, native production alias, or invitation acceptance was added. Evidence: `docs/verification/2026-08-04-native-enrollment-contract.md`.
- The second runtime-disconnected Slice 1B increment freezes the exact domain-separated P-256 ECDH/HKDF-SHA-256/HMAC-SHA-256 possession transcript and a reproducible synthetic vector. The challenge now binds server-derived claimant, invitation/version, eligibility/version, policy/version, origin, issue/expiry, nonce, KDF salt, device digest, key/version/fingerprint, and server ephemeral key. Hostile tests mutate every bound field. Invitation bootstrap uses server-side `email-ascii-v1` normalization and a keyed HMAC address index; the Phase 1 client-supplied digest is explicitly insufficient for live production. Full shared/mobile/web/API/shared-validation tests, all workspace typechecks, lint, and security/isolation checks pass. No runtime was added. Evidence: `docs/verification/2026-08-04-native-enrollment-possession-proof-review-pack.md`.
- The internal adversarial Slice 1B review corrected exact-case email handling, canonical encodings, UUIDv4 locator validation, safe versions, the exact 300-second TTL, stable-reference transport, and the AES-256-GCM server-ephemeral profile. It added server-only normalization/keyed-index conformance and RFC 5869/off-curve tests. Production still requires independently approved App Attest binding, point validation, key management, delivery-token expiry/retention, and native adapter evidence. Evidence: `docs/verification/2026-08-04-slice-1b-internal-adversarial-review.md`.
- Slice 1C supplies the strict reviewed App Attest registration/assertion contract, deterministic vectors, and hostile consumers. The owner-accepted design-review gate is closed, and PR #65 supplies the later hard-disabled native/server/persistence/controller/mobile boundaries. Apple-issued end-to-end fixtures, physical production-adapter evidence, hosted integration, and activation remain required. Evidence: `docs/verification/2026-08-04-app-attest-contract.md` and `docs/verification/2026-08-12-native-enrollment-review-closure.md`.
- Phase 2 Slice 1D has a code-complete hard-disabled iOS App Attest adapter behind an exact isolated bundle-ID gate, a dedicated iOS 27 development-entitled build profile, opaque-byte hashing, device-only key-ID persistence, strict output allowlists, safe errors, and a value-free evidence coordinator/UI. PR #65's iOS simulator compile/launch jobs pass. Apple-issued App Attest objects and the dedicated physical-iPhone App Attest matrix remain pending exact external-action authorization, so production-native evidence is still open. Evidence: `docs/verification/2026-08-12-claimant-slice-1d-native-app-attest-adapter.md`.
- Phase 2 Slice 1E now has a code-complete, unmounted server verifier and default-deny persistence boundary. It strictly parses CBOR/DER, validates registration/assertion cryptographic bindings through an offline caller-pinned Apple-root adapter, enforces the iOS 27 bundle/category extensions and monotonic counters, and persists verified public state through service-role-only idempotent transactions. Local hostile/API/database/security checks pass. Apple-issued fixture/Slice 1D integration and independent Apple-side review remain required before any route. Evidence: `docs/verification/2026-08-12-claimant-slice-1e-server-app-attest-verifier.md`.
- Phase 2 Slice 1F now has a code-complete, unmounted native-enrollment transaction boundary. It generates and persists exact single-use registration/native/App-Attest challenges, seals the server ephemeral scalar under context-bound AES-256-GCM custody, verifies native ECDH/HKDF/HMAC possession plus Slice 1E App Attest evidence, and atomically consumes both challenges while accepting the invitation, creating the exact pre-bound claimant key/case, advancing the assertion counter, and appending audit/outbox state. Hostile and rollback tests pass. No HTTP route or external runtime exists. Evidence: `docs/verification/2026-08-12-claimant-slice-1f-native-enrollment-transaction.md`.
- Phase 2 Slice 1G now mounts the four native-enrollment controller operations behind an immutable compile-time approval set to `false`. The enabled path derives confirmed-address, claimant/session, eligibility, invitation, App Attest key/device, policy, and app authority server-side; enforces exact origin/schema/size/idempotency/fresh-AAL2 boundaries; and applies forced-RLS per-account throttling. Disabled requests are concealed before configuration or CORS. All 114 API tests and the live controller database test pass. Apple-native, hosted MFA, edge abuse, hosted migration, and activation gates remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1g-native-enrollment-controller.md`.
- Phase 2 Slice 1H adds a hard-disabled, runtime-disconnected mobile HTTPS transport and enrollment coordinator. It validates canonical server transcripts and cross-bindings, sends no client authority, orchestrates registration/native proofs through injected adapters, cleans up keys before finalization failures, and preserves keys after ambiguous final commit for reconciliation. It does not import or promote the disposable probe aliases, and normal mobile runtime cannot import it. All 439 mobile tests pass with 3 environment-gated skips. Evidence: `docs/verification/2026-08-12-claimant-slice-1h-mobile-enrollment-coordinator.md`.
- Phase 2 Slice 1I adds a hard-disabled encrypted mobile attempt store and service-only reconciliation boundary. It records only bounded identifiers, request digests, phase/expiry, and a non-secret key alias; final recovery asks server authority before deletion, while the database serializes reconciliation against acceptance and invalidates terminal non-commits. Full hostile mobile/API/database coverage passes. Production adapters and all activation gates remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1i-enrollment-attempt-reconciliation.md`.
- Phase 2 Slice 1J adds hard-disabled production-shaped App Attest/custody adapter contracts, canonical request digests, and a runtime-disconnected lifecycle composition root. Probe APIs/aliases fail isolation, concurrent operations are rejected, and ambiguous final submission is reconciled before session-teardown key deletion. Actual Swift production methods, entitlements, direct binding, and Apple evidence remain open. Evidence: `docs/verification/2026-08-12-claimant-slice-1j-native-lifecycle-adapters.md`.
- Phase 2 Slice 2A adds a hard-disabled, unmounted claim-intake/checklist persistence boundary. Two forced-RLS service-only tables and one transactional RPC require the active claimant portal session, exact case/claimant/policy/version binding, active identity/key, six bounded synthetic routing facts, all seven common checklist items, idempotency, and a locked `draft` to `identity_pending` transition with value-free audit. No route, upload, document metadata, hosted migration, or external runtime exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2a-intake-checklist-foundation.md`.
- Phase 2 Slice 2B adds hard-disabled, unmounted, append-only evidence-preparation metadata persistence. It stores synthetic placeholder reference, allowlisted media type, bounded size, claimed preparation time, or an unavailable declaration; exact claimant/case/checklist/policy/version binding, active session/identity/key checks, version locking, idempotency, and value-free audit fail closed. Prepared metadata remains `pending`, never `available`, and never advances the case or claims upload/scan/receipt. Evidence: `docs/verification/2026-08-12-claimant-slice-2b-evidence-preparation-metadata.md`.
- Phase 2 Slice 2C adds a hard-disabled, unmounted private-quarantine foundation: one private 25 MiB bucket with deny-all client object policies; deterministic server-keyed, five-minute, one-time case-bound capabilities stored only as digests; bounded signature/type/size/PDF-page/expanded-size/archive-count validation; injected fail-closed scanner and Storage adapters; and service-only quarantine, scan, retention/legal-hold, and two-phase deletion transactions. No upload HTTP route, byte streaming implementation, real provider, hosted migration, or real evidence exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2c-private-quarantine-foundation.md`.
- Phase 2 Slice 2D adds a hard-disabled, unmounted streaming upload/reconciliation processor. It enforces 25 MiB total, 1 MiB chunk, 30-second abort, exact case/object/path/type/size binding, streaming SHA-256, post-write inspection, quarantine-before-scan, fail-closed scanner persistence, server-authoritative ambiguity checks, and atomic capability abandonment before orphan cleanup. A committed object is never deleted after a lost response. No HTTP route, real parser/provider adapter, hosted change, or external behavior exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2d-upload-processor.md`.
- Phase 2 Slice 2E mounts capability issue, raw upload, and reconciliation paths behind an immutable-false controller gate. The enabled test-only path requires the exact HTTPS API origin and claimant portal origin, bearer-derived fresh AAL2, an active claimant portal session, exact per-operation CORS/headers/content types, UUIDv4 idempotency, mandatory bounded `Content-Length`, database-authoritative capability/path/type/size preflight, and claimant-case concurrency. Processor actor and sub-operation idempotency are server-derived. Deterministic synthetic adapters accept only exact predeclared bytes and remain disabled and disconnected from the API entrypoint. No real parser/provider, hosted configuration, migration, real file, distributed edge control, or external access exists. Evidence: `docs/verification/2026-08-12-claimant-slice-2e-upload-controller.md`.
- Phase 2 Slice 2F adds an immutable-false, runtime-disconnected web upload coordinator with injected transport only. It binds exact synthetic placeholder/version/body metadata, validates capability/object/path/terminal responses, enforces monotonic bounded progress and single-flight work, and reconciles conflict, unavailable, or malformed completion before success. Only a capability/object tuple can survive in memory for explicit retry; no evidence bytes or capability enter browser persistence. Static isolation prohibits normal runtime imports, direct network/file APIs, provider SDKs, and object-storage endpoints. Evidence: `docs/verification/2026-08-12-claimant-slice-2f-upload-client-coordinator.md`.
- Phase 2 Slice 2G adds an immutable-false, runtime-disconnected dashboard read-model coordinator with injected transport only. It accepts only an exact coherent triplet of safe journey, review-tracking, and decision-readiness projections bound to one case/version; rejects extra private fields, future/precise dates, stale rollback, same-version divergence, and cross-case substitution; clears old case state before switching; and retains only a recursively frozen memory snapshot. Evidence: `docs/verification/2026-08-12-claimant-slice-2g-dashboard-read-model-coordinator.md`.
- Phase 2 Slice 2H adds one hard-disabled server-owned submission transaction, directly unmounted at that checkpoint and now reachable only through Slice 2I's independently concealed controller. It locks and reasserts exact portal, claimant, current-key, case/version, policy, intake, latest preparation, checklist disposition, consumed-capability, and clean-object authority before atomically advancing to `submitted` and writing an append-only safe receipt, value-free audit/outbox events, and idempotency result. Replay is stable, changed input fails, and late failures fully roll back. The acknowledgement explicitly keeps review and release false. Evidence: `docs/verification/2026-08-12-claimant-slice-2h-submission-acknowledgement-transaction.md`.
- Phase 2 Slice 2I mounts that submission transaction behind an independent immutable-false controller. Disabled requests are concealed before configuration/CORS; the test-only enabled path requires exact HTTPS API and claimant origins, JSON and bounded body, UUIDv4 route/idempotency values bound into the strict envelope, bearer-derived fresh AAL2 without recovery, active portal authority, and bounded claimant-case concurrency. Responses expose only the safe acknowledgement, database failures are generic, and notification providers remain disconnected. Evidence: `docs/verification/2026-08-12-claimant-slice-2i-submission-controller.md`.
- Phase 2 Slice 2J adds an immutable-false, runtime-disconnected web submission coordinator with injected transport only. It validates the exact synthetic envelope and safe acknowledgement, owns one stable UUIDv4 attempt key, serializes work, retains ambiguous or aborted dispatch authority only in memory for exact retry, and retains no acknowledgement after success. Static isolation rejects normal runtime imports, direct networking, browser persistence, providers, notifications, and private/internal fields. Evidence: `docs/verification/2026-08-18-claimant-slice-2j-web-submission-coordinator.md`.
- Phase 3 Slice 3A adds immutable-false, unmounted service-only owner-protection transactions. Forced RLS and explicit grants protect value-free cycle/events/idempotency data; verified delivery alone activates cooldown, while failed/ambiguous delivery, owner cancellation, claimant dispute, material change, and conflicting authority fail closed without review/release authority. Hosted rollback-only verification passed and left production unchanged. Evidence: `docs/verification/2026-08-18-claimant-slice-3a-owner-protection-foundation.md`.
- Phase 3 Slice 3B adds an immutable-false, unmounted owner-notice delivery coordinator with injected queue/provider contracts. It dispatches only the first claimed attempt, uses stable-key provider lookup as the sole delivery authority, hashes exact value-free verified receipts, fails uncertainty closed, and replays ambiguous persistence without redispatch. Evidence: `docs/verification/2026-08-18-claimant-slice-3b-owner-notice-delivery-coordinator.md`.
- Phase 3 Slice 3C adds a forced-RLS service-only owner-notice delivery queue and strict Supabase transaction client. It persists stable delivery authority before contact, excludes active leases, reclaims expired leases without redispatch, and completes only against the exact current lease and committed Slice 3A result. Evidence: `docs/verification/2026-08-18-claimant-slice-3c-owner-notice-delivery-queue.md`.
- Phase 3 Slice 3D adds independently concealed owner-cancellation and claimant-dispute HTTP boundaries. Exact separate origins and role-specific session clients prevent cross-mode confusion; server-derived actors, fresh AAL2, active session assertions, fixed reasons, strict input limits, bounded concurrency, and generic failures protect the Slice 3A stop transaction. Evidence: `docs/verification/2026-08-18-claimant-slice-3d-owner-protection-controller.md`.
- Phase 3 Slice 3E adds an immutable-false, unmounted reviewer assignment/conflict/recusal foundation. Separate synthetic reviewer identities, two distinct active slots, exact case/cycle/cooldown binding, owner/claimant related-party denial, forced RLS, security-invoker service transactions, append-only value-free events, locking, idempotency, stale-version enforcement, and safe reassignment all pass hostile coverage. No decision, approval count, release predicate, reviewer UI, or evidence access exists. Evidence: `docs/verification/2026-08-18-claimant-slice-3e-reviewer-assignment-foundation.md`.
- Phase 3 Slice 3F adds an immutable-false, unmounted independent-review foundation. Append-only blind decisions bind current assignments and exact case/cycle/submission/intake/preparation/policy/checklist/clean-evidence authority. Distinct-slot constraints, prior-assignment revalidation, and aggregate-only responses enforce independence. Two allows satisfy review approval but never change the case or authorize release. Evidence: `docs/verification/2026-08-18-claimant-slice-3f-independent-review-foundation.md`.
- Phase 3 Slice 3G adds an immutable-false, unmounted escalation/appeal foundation. Separate synthetic resolution authorities cannot overlap the owner, claimant, or reviewer identities. Locked idempotent interventions persist immutable safe reasons/events, force the exact review round to `held`, clear any two-person approval, preserve case cooldown, and keep release false. Evidence: `docs/verification/2026-08-18-claimant-slice-3g-review-escalation-appeal-foundation.md`.
- Phase 4 Slice 4A adds an immutable-false, unmounted final release-authorization foundation. A distinct synthetic final authorizer revalidates the exact current case/cycle/review/policy/submission/finalization authority, absence of interventions, and at least two active claimant keys with matching current recipient grants. Only `cooldown` to `approved` is permitted; package creation and retrieval remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4a-release-authorization-foundation.md`.
- Phase 4 Slice 4B adds an immutable-false, unmounted encrypted-package preparation foundation. A locked service-only transaction copies only exact active owner vault ciphertext/nonce envelopes, binds every current claimant recipient grant/key version and the current final authorization, and stores an immutable unsigned 72-hour snapshot with a server-computed ordered digest. The case stays approved; manifest signing and retrieval remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4b-encrypted-package-foundation.md`.
- Phase 4 Slice 4C adds an immutable-false, unmounted signed-manifest/package-finalization foundation. The service validates the frozen canonical manifest contract and detached Ed25519 signature against a separately resolved synthetic public key. The locked transaction requires exactly one signed manifest per current package grant, rechecks the immutable 4B snapshot and all release authority, then advances only to `release_ready`; retrieval remains false. Evidence: `docs/verification/2026-08-18-claimant-slice-4c-signed-manifest-foundation.md`.
- Phase 4 Slice 4D adds an immutable-false, unmounted retrieval-session authorization foundation. Verified Supabase identity/session claims and fresh AAL2 derive the claimant and authentication timestamp server-side. A locked service-only transaction binds a maximum-15-minute `authorized_unserved` record to the exact active claimant portal context, current release-ready finalization, signed manifest, grant, and active recipient key version. The case stays `release_ready`; package serving and retrieval completion remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4d-retrieval-session-foundation.md`.
- Phase 4 Slice 4E adds an immutable-false, unmounted encrypted-package delivery transaction/coordinator. One exact live Slice 4D authorization is revalidated before exposing only the frozen ciphertext envelopes, claimant-addressed encrypted grant, and signed manifest under an exact digest/byte/lease binding. Lookup alone proves complete delivery and replay never redispatches. The first verified receipt records `package_served` and advances the case once to `released`; retrieval completion remains false. Evidence: `docs/verification/2026-08-18-claimant-slice-4e-encrypted-package-delivery.md`.
- Phase 4 Slice 4F adds an immutable-false, runtime-disconnected mobile native-package open coordinator and adapter contract. It cross-binds the exact served ciphertext payload, canonical signed manifest, trusted Ed25519 key, case/package/session, grant, recipient key/version, ordered ciphertext digests and expiry before delegating verification/decryption to one injected native-shaped operation. JavaScript receives only an opaque local-open reference and value-free counts; export and server retrieval completion stay false. Evidence: `docs/verification/2026-08-18-claimant-slice-4f-native-package-open.md`.
- Phase 4 Slice 4G adds an immutable-false, unmounted verified retrieval-completion foundation. One locked service-only transaction consumes the exact served delivery plus a separately verified claimant-device/App-Attest native-open proof, advances the App Attest counter, and atomically records only retrieval completion with stable replay. The case remains released; export and closure remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4g-retrieval-completion.md`.
- Phase 4 Slice 4H adds an immutable-false, unmounted retrieval suspension/expiry foundation. One locked service-only transaction serializes against authorization, delivery and completion, then ends every future serving/retrieval authority while preserving whether a package was already served or opened. Served/completed states are explicitly unrecalled; local deletion, export and closure are never claimed. Evidence: `docs/verification/2026-08-18-claimant-slice-4h-retrieval-suspension-expiry.md`.
- Phase 4 Slice 4I adds a hard-disabled, runtime-disconnected native local-export coordinator and adapter contract. It requires exact active completed-open authority, explicit claimant intent, fresh native device-owner presence and confirmation, strict expiry/timing/cross-object bindings, and returns only an opaque value-free local-copy receipt. JavaScript/server plaintext, upload and closure remain false. Evidence: `docs/verification/2026-08-18-claimant-slice-4i-native-local-export.md`.
- Phase 4 Slice 4J adds an immutable-false, unmounted retrieval-lifecycle closure foundation. A service-only locked transaction requires the exact served/opened completion authority and accepts only no export or an all-or-none separately verified value-free Slice 4I export fact. It appends administrative closure without updating case, delivery, session, completion, access-control, or local state; historical truth remains intact and local recall/deletion stay false. Evidence: `docs/verification/2026-08-18-claimant-slice-4j-retrieval-lifecycle-closure.md`.
- Phase 5 Slice 5A adds a hard-disabled, runtime-disconnected safe V2 offline-code shared protocol. It splits a 128-bit non-secret checksummed locator from a 192-bit client-held secret, pins exact synthetic-only Argon2id parameters, domain-separates proof and wrap derivations, fixes possession-only authority, cross-binds record/challenge/proof/wrap objects, rejects V1 and malformed/weak/substituted inputs, and adds reproducible hostile vectors plus a CI runtime-isolation guard. Evidence: `docs/verification/2026-08-19-claimant-slice-5a-offline-code-v2-protocol-foundation.md`.
- Phase 5 Slice 5B adds five forced-RLS service-only tables and four security-invoker transactions for keyed locator records, exact five-minute challenges, append-only proof-attempt facts, fifteen-minute/five-failure lockout, stable replay, value-free events, expiry and revocation. It stores no raw locator, client secret, private proof key, root, wrap key, or plaintext MEK; verified proof remains possession-only and creates no identity, claim, or release authority. The service is literal-false and unmounted. Evidence: `docs/verification/2026-08-19-claimant-slice-5b-offline-code-v2-persistence.md`.
- Phase 5 Slice 5C adds a literal-false challenge coordinator and service-only rate budget. Global, network, device, and locator budgets are consumed before lookup; known, unknown, expired, revoked, and locked records receive the same schema and replay semantics; canonical challenge bytes are database-generated; and only active-record challenges persist. It is now wired only through the immutable-false Slice 5E controller. Evidence: `docs/verification/2026-08-19-claimant-slice-5c-offline-code-v2-challenge-coordinator.md`.
- Phase 5 Slice 5D adds a literal-false proof-verification/attempt coordinator. It reconstructs and verifies the exact domain-separated Ed25519 transcript, requires canonical challenge bytes and complete proof/challenge cross-binding, records bounded attempt facts through Slice 5B, keeps invalid unavailable-record behavior indistinguishable, and returns only possession authority on success. It is now wired only through the immutable-false Slice 5E controller. Evidence: `docs/verification/2026-08-30-claimant-slice-5d-offline-code-v2-proof-attempt-coordinator.md`.
- Phase 5 Slice 5E mounts the challenge and path-bound proof endpoints behind an independent literal-false controller. Its enabled synthetic path enforces exact origins, CORS, JSON, UUIDv4 idempotency, body limits, no Auth/Cookie identity input, trusted-signal-only keyed rate buckets, and possession-only responses. No trusted-edge adapter exists, so that enabled path fails before persistence without explicit injection. Evidence: `docs/verification/2026-08-30-claimant-slice-5e-offline-code-v2-controller.md`.
- Phase 5 Slice 5F adds a hard-disabled, runtime-disconnected mobile proof producer and bounded benchmark harness. It reproduces the frozen Argon2id/HKDF/Ed25519 vector, validates all locator/record/challenge bindings, wipes derived key buffers, emits possession-only proof, and keeps benchmark reports synthetic and production-unapproved. The five-sample desktop reference is not physical-device evidence. Evidence: `docs/verification/2026-08-30-claimant-slice-5f-offline-code-v2-client-proof.md`.
- Phase 5 Slice 5G adds a literal-false, runtime-disconnected physical KDF evidence runner. Exact non-production physical-device/thermal/power/operator/value-free preconditions precede execution; untrusted benchmark output is strictly validated; and reports say only measured/invalid/runner-error while keeping production approval false. No physical run occurred. Evidence: `docs/verification/2026-08-30-claimant-slice-5g-offline-code-v2-kdf-evidence.md`.
- Phase 5 Slice 5H adds a separate internal-preview physical iOS/Android KDF probe router/build profile with distinct app identities. It runs only the frozen synthetic five-sample benchmark through Slice 5G and displays aggregate value-free evidence. Normal app builds cannot import it. No EAS build or device run occurred. Evidence: `docs/verification/2026-08-30-claimant-slice-5h-offline-code-v2-kdf-probe-host.md`.
- The iOS Secure Enclave probe harness now uses only `probe-only.v3`, passcode-set device-only Keychain accessibility, `.privateKeyUsage` plus `.userPresence`, canonical unpadded Base64URL, the frozen V1 fingerprint/HKDF/HMAC labels, secure random salt/nonce, and creation/exercise fingerprint continuity. Normal application runtime does not import it. Separate internal EAS Build 1 compiled successfully, and the owner-reported physical pass/cancel/retry/cleanup matrix passed. Evidence: `docs/verification/2026-08-04-ios-secure-enclave-probe-harness.md` and `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`.
- The physical-iPhone evidence coordinator freezes exact non-production/iOS/operator/passcode/value-free preconditions and emits only generic result classes, timestamps, continuity/pass booleans, and a run ID. It has no entry point in normal application runtime. The separate signed probe host compiled and the owner-reported authenticated pass, cancellation/cleanup, and retry matrix passed. Evidence: `docs/verification/2026-08-04-physical-iphone-evidence-runner.md` and `docs/verification/2026-08-04-physical-iphone-custody-probe-build.md`.

## Engineering Target

Deliver a production-ready-but-disabled claimant system that supports the complete user journey with synthetic data in a production-shaped environment:

- Registered-recipient invitation, account creation, verified binding, MFA, recovery, and claimant key enrollment.
- Safe V2 code initiation using a split public locator and client-only secret; never use V1 for public lookup.
- Claim creation, relationship and authority details, document checklist selection, resumable evidence preparation, upload, submission, and safe acknowledgement.
- Persisted claimant dashboard states that expose only approved public information.
- Owner notice, cooldown, cancellation, dispute, hold, and value-free notification processing.
- Reviewer assignment, conflict/recusal handling, two distinct approvals, escalation, and appeal modelling.
- Server-controlled case transitions, idempotency, audit/outbox processing, reconciliation, and rollback.
- Claimant-addressed encrypted release packages, bounded retrieval sessions, native local decryption, read-only presentation, optional local export, expiry, and suspension.
- Complete monitoring, alerting, backup/restore, deletion, incident, and kill-switch behavior required to operate the code safely.

## Definition Of Engineering Production Ready

The claimant code may be described as engineering production ready only when all of the following are evidenced against one immutable candidate commit:

- Both claimant routes complete end to end using synthetic data in a production-shaped environment.
- Every production capability defaults to disabled and can be stopped independently without a deployment.
- Authentication, fresh assurance, database/API/RLS/Storage authorization, and claimant/case binding fail closed.
- No claimant has a path to owner vault rows, owner key material, another claim, or another claimant's evidence.
- Uploads enforce randomized case-bound paths, bounded capabilities, signature/type/size/page/count/decompression rules, and a malware-scanning adapter with deterministic test behavior.
- Case transitions, audit append, outbox creation, and idempotency decisions are transactional or have tested reconciliation and rollback.
- Dashboard projections cannot reveal reviewer identity, owner-response detail, fraud signals, internal notes, exact sensitive timers, or release predicates.
- Release infrastructure serves ciphertext plus exactly one claimant-addressed material profile; browser/backend plaintext is impossible by design.
- Native claimant clients prove local key custody, local decryption, expiry/suspension handling, and deterministic plaintext/key clearing.
- Hostile cross-owner, cross-claimant, cross-case, replay, race, stale-version, duplicate-delivery, partial-failure, and restore tests pass.
- Production-shaped configuration validation, observability, privacy-safe logs, SBOM/dependency review, rollback, backup/restore, and disaster exercises pass.
- Known limitations and provisional policy values are configurable and documented rather than silently hard-coded.

Engineering production readiness is not launch authorization. External access remains blocked until the launch gates below are complete.

## Implementation Order

### Phase 0 — Code-readiness audit and safe foundations

- Map every synthetic contract and preview to its required runtime producer and consumer.
- Add disabled-by-default feature/config flags, environment validation, and independent kill switches.
- Confirm owner, claimant, public, API, evidence, reviewer, and native-client trust boundaries.
- Establish production-shaped local/test environments and synthetic seed/reset tooling.

### Phase 1 — Shared claimant platform

- Claimant identity, invitation, public device-key, and registered-recipient case foundation: complete in Phase 1 Slice 1, default-deny and server-only.
- Transactional invitation issuance/acceptance, idempotency, audit, and value-free outbox records: complete in Phase 1 Slice 2, service-role-only.
- Authenticated, capability-guarded issue/accept API adapter with exact origin/content-type/CORS, server-derived actors, strict allowlists, and hostile tests: complete in Phase 1 Slice 3; mounted but concealed while disabled.
- Fresh timestamped AAL2, bounded recovery restrictions, server-owned session activation/displacement/revocation, and active-session enforcement on both mutations: complete in Phase 1 Slice 4.
- Case-scoped second-device enrollment, key replacement/revocation, invitation revocation, strict V2 ciphertext grants, invalidation, and owner finalization: complete in Phase 1 Slice 5.
- Phase 1 registered-recipient platform foundations are complete locally.
- Slice 1A hosted sign-in/MFA client wiring is parked at the paid-plan gate without weakening server enforcement. Slice 1B/1C, disposable custody-probe evidence, and the owner-accepted 2026-08-12 adversarial review/remediation are complete. Slice 1D-1H merged in PR #65; the registered-recipient foundation is complete through Slice 4J `49ee8a8`, and Slice 5A is complete at `d6cb3d2`. Slice 1G/1H/1I/1J/2A-2J/3A-3G/4A-4J and 5A approvals remain immutable false. Native Swift implementation/evidence, hosted MFA, provider selection, distributed edge abuse controls, and external activation remain gates.

### Phase 2 — Registered-recipient journey

- Wire invitation acceptance, account/key enrollment, claim initiation, checklist, evidence preparation, upload, submission, acknowledgement, and persisted dashboard tracking.
- Add server-owned intake/submission transition functions and hostile RLS/API/Storage isolation tests as their Phase 2 schemas and routes are introduced.
- Keep evidence synthetic and notifications captured by test adapters.

### Phase 3 — Review and owner-protection journey

- Wire owner notice, provisional cooldown, cancellation, dispute, hold, reviewer assignment, conflict/recusal, two-person approval, escalation, and appeal.
- Enforce server/database authority and value-free public projections.

### Phase 4 — Encrypted release and native retrieval

- Wire package preparation, claimant-addressed encryption, bounded sessions, native local opening, read-only presentation, optional local export, expiry, suspension, and closure.
- Prove that delivery does not claim local open or plaintext receipt.

### Phase 5 — Safe V2 offline-code journey

- Implement the split locator/client-secret protocol, domain-separated proof, enumeration resistance, throttling, attempt controls, expiry, revocation, and explicit V1 rejection.
- Slice 5A completes the split-material protocol foundation; Slice 5B completes local default-deny persistence; Slice 5C completes enumeration-resistant challenges; Slice 5D completes proof verification and bounded attempts; Slice 5E completes a mounted but immutable-false HTTP boundary; Slice 5F completes runtime-disconnected client proof production and a synthetic benchmark harness; Slice 5G completes the disabled evidence boundary; Slice 5H completes the isolated internal probe host/profile; Slice 5I completes the disabled injected mobile transport/coordinator; Slice 5J completes its disabled synthetic lifecycle composition. External probe builds and physical runs, production KDF approval, production client runtime integration, trusted-edge throttling, post-possession case binding, and activation remain unimplemented.
- Add representative-device KDF benchmarks and reproducible protocol vectors.
- Reuse the common intake, evidence, dashboard, review, and release platform after safe case binding.

### Phase 6 — Production-hardening acceptance

- Run complete end-to-end, hostile authorization, race/replay, outage, reconciliation, backup/restore, deletion, observability, and rollback suites.
- Freeze one immutable engineering candidate and produce a value-free readiness report and residual-risk register.
- Keep runtime flags disabled and stop for launch governance.

Each phase must be delivered in small reviewable code changes with exact scope, non-goals, tests, rollback, and updated handoffs. Passing one phase does not authorize deployment or activation.

## Non-Negotiable Technical Boundaries

- Authentication, MFA, code possession, relationship, identity proofing, evidence review, release authority, and cryptographic possession are separate controls.
- No individual control—and no owner non-response—authorizes release.
- Never submit, log, email, place in a URL, or store a complete emergency secret.
- Claimants never receive a policy path to owner vault rows, key material, another claim, or another claimant's evidence.
- Infrastructure stores and serves ciphertext plus approved metadata only for owner vault material.
- Claimant evidence is separate server-visible sensitive PII and must remain in an isolated private quarantine.
- Browser-readable release PDFs, server-side decryption, system-known PDF passwords, and server-recoverable claimant private keys are prohibited.
- Claim-sensitive actions require fresh authenticated sessions and enforced `aal2` in UI, API, and database policy.
- Case state, authority, approvals, deadlines, and release eligibility are server/database controlled; client values are untrusted.
- Owner clients seal claimant-addressed ciphertext locally; servers never perform that encryption but remain authoritative for validation, authorization, persistence, case transitions, and finalization.
- Package prepared, served, opened, exported, claimant-confirmed, expired, suspended, and closed are distinct events.
- Suspension can block future retrieval but cannot recall information already decrypted locally.
- Development and engineering acceptance use dedicated synthetic identities, records, documents, notifications, and release material only.

## Governance And Launch Gates

These items do not block the engineering programme, but every applicable item blocks external access or production activation:

- Confirm the operating/contracting entity, controller details, processor map, governing law, and supported jurisdiction policy packs.
- Approve evidence authority, sufficiency, translation, minimization, legal basis, retention/deletion, rights, legal hold, breach, dispute, appeal, and cross-border rules.
- Name and train operational reviewers; approve qualifications, separation, conflicts, access, escalation, staffing, and incident procedures.
- Treat the Shahbaz Malik/Codex interim test assignment as synthetic engineering coverage only; replace it with at least two qualified independent human reviewers and disable all synthetic reviewer identities before external access, real claimant data, package creation, or release.
- Complete independent legal/privacy, security, native/cryptographic, operational, and application assurance against the immutable engineering candidate.
- Approve production providers, plans, DPAs/subprocessors, origin architecture, WAF/DDoS controls, monitoring, support, backup/restore, and incident response.
- Complete `EDGE-01` through `EDGE-03`, the owner-web P0 controls in `SECURITY_HANDOFF.md`, production configuration evidence, and controlled launch approval.

No real claimant data may be collected and no external claimant capability may be enabled until these launch gates are recorded as complete or an explicit documented exception is approved by the actual accountable owner and required specialists.

## Authoritative Design Set

- `docs/superpowers/specs/2026-07-31-claimant-slice-2-decision-register.md`
- `docs/superpowers/specs/2026-07-31-claimant-threat-control-matrix.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-approval-checklist.md`
- `docs/superpowers/specs/2026-07-31-claimant-slice-2-specialist-review-pack.md`
- `docs/superpowers/specs/2026-07-31-claimant-document-checklist-catalog.md`
- `docs/superpowers/specs/2026-07-31-claimant-mvp-manual-review-retrieval-flow.md`
- `docs/superpowers/specs/2026-07-28-claimant-key-custody-client-boundary.md`
- `docs/superpowers/specs/2026-07-28-claimant-custody-probe-evidence.md`

Use these as current design inputs, not as proof of implemented runtime or launch approval. Update superseded assumptions alongside the code slice that changes them.

## Historical Evidence Retained

- PR #54 passed protected CI and was internally accepted for bounded synthetic-prototype circulation. External specialist approvals remained outstanding.
- Prototype acceptance recorded 141 web tests, 110 shared claimant tests, and 42 shared validation tests passing, plus workspace typechecks, lint, production web build, security guards, vector isolation, and custody isolation.
- The synthetic acceptance suite proved deterministic modelling and safe projections only; it did not prove production authentication, persistence, uploads, operations, native release, or deployment.
- PR #58 merged the owner-web security baseline and `brace-expansion` production-path remediation at `c0a14e1`.
- PR #59 merged documented edge/WAF/DDoS gates at `887abd0459197c5123b8972e1b8c5bed14ec5528`; it made no provider, DNS, hosting, or runtime change.

## Repository Publishing Rule

Do not publish documentation or administrative changes alone. Keep them local and include them with the next authorized, reviewed code change. This rule does not authorize a code change, deployment, external configuration, or any other administrative action by itself.
