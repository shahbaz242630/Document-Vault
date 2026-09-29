# Claimant W2a phone-access session close — 2026-09-29

This is the current checkpoint and the opener for the next session. It supersedes `2026-09-26-claimant-w1-w2a-session-close.md`, which is still the reference for W1 and W2a scope and the live hosted state.

**Where this file lives:** on the branch `claude/gifted-turing-lm2en4`. By the owner's rule (no docs-only PRs), it reaches `main` with the next code PR. If `main` doesn't have it yet, read it from that branch.

## Delivered and merged this session

- **PR #105 (`d85ef55`): device clock tolerance in the offline-code proof path.**
  - **Found by** the owner's first local run on Windows. The laptop was about 1 second behind the server, and the device-side challenge-window checks had zero tolerance.
  - **Fix.** `offline-code-v2-proof-core.ts` and `offline-code-v2-coordinator.ts` now accept a device clock up to 2 minutes slow or fast (`OFFLINE_CODE_V2_CLIENT_CLOCK_SKEW_MS`). The server still enforces the real window.
  - **Proof.** The failure was reproduced with a clock shifted 5 seconds slow: it failed on the old code and passed on the new.
  - The PR also carried the 2026-09-26 close-out.
- **PR #106 (`5edc637`): the Preview app's dedicated Vercel bypass.**
  - **Why.** Vercel's standard protection also covers *preview* custom domains, and the Hobby plan can't exempt one.
  - **What.** `withClaimantPreviewBypass` (`apps/mobile/src/shared/config/claimant-preview-fetch.ts`) sends `x-vercel-protection-bypass` only in the Preview build. The value comes only from the EAS `preview` environment (`EXPO_PUBLIC_CLAIMANT_PREVIEW_API_BYPASS`).
  - **Address.** The Preview app now calls the branch alias.
  - **Pinned by** the isolation check: its three users, and that the value is never in `eas.json`.
  - It also carried the record of the owner's passing Windows rerun.

## Verified this session

- **Owner's Windows laptop, against `main` at `d85ef55`:**
  - env guard PASS;
  - hosted catalog PASS (48 migrations, 0 violations);
  - **hosted acceptance PASS, 11 of 11**;
  - cleanup 0.
- **Every CI check was green** on PRs #105 and #106 before merge.

## Owner-side setup completed this session

- **DNS:** Hostinger has the CNAME `preview-api` → `cname.vercel-dns.com`. The domain is verified on `sanduqkin-api` for `claimant-preview`, and its certificate is issued (`cert_ric5bcwytw9SJzVzvhGLfPK0`). It still sits behind the Vercel login, so it's **attached but unused**. The app and the tests use the branch alias.
- **Vercel:** a second "Protection Bypass for Automation" secret was added, noted "Sanduqkin Preview app". Vercel Authentication stays ON. The first secret is still used by the hosted acceptance.
- **EAS `preview` environment:** it has `EXPO_PUBLIC_CLAIMANT_PREVIEW_API_BYPASS` (sensitive), `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Local runs:** the owner has `.env.claimant-preview` on the laptop, and Claude Code there runs the local checks.

## Live state

- `main` = `claimant-preview` = `claude/gifted-turing-lm2en4` = `5edc637`.
- The Supabase and Vercel Preview configuration is as in the 2026-09-26 close-out, and unchanged.
- There is no synthetic data on the hosted database (cleanup reports 0).
- **Nothing is watched or scheduled:** no PR subscriptions and no timers.

## Owner decisions this session

1. Fix the clock check now, as its own PR, with auto-merge.
2. For phone access, a **dedicated Vercel bypass in the Preview app only**, deleted after phone testing. The alternatives were turning off preview login, upgrading to Vercel Pro, or a separate project.
3. The auto-merge-when-green rule continued (PRs #105 and #106).

## Pending — owner-held (next steps, in order)

1. **Android signing key (one time):** in `apps/mobile`, run `npx eas-cli@21.0.0 credentials --platform android`, choose profile `claimant-preview`, and let EAS generate a keystore for `com.sanduqkin.mobile.claimantpreview`.
2. **Build:** Actions → "Claimant Preview app build" on `main`, choosing `android`, with the confirmation `claimant-preview`. The APK link then appears in the Expo dashboard.
3. **Test owner account:** open question to the owner, not yet answered. The session offered to create a synthetic owner on the reserved pattern `claimant-preview-synthetic-<12 hex>@sanduqkin.invalid` so the cleanup removes it later. The owner then enrols TOTP in the app.
4. **Phone run:**
   1. On phone 1, sign in with TOTP.
   2. Print a sheet, and list it.
   3. Print and revoke a second one.
   4. On phone 2, "Check an emergency sheet": the live sheet should say "valid" and the revoked one "can't be used".
   5. Run the cleanup until it reports 0.
   6. Record the results in `docs/verification/2026-09-26-claimant-w2a-phone-preview.md`.
5. **After the phone run:** delete the "Sanduqkin Preview app" Vercel bypass and its EAS variable.
6. **Rotate the Supabase and Vercel tokens** used in the cloud sessions. They still worked on 2026-09-29. Update the laptop's `.env.claimant-preview` afterwards.
7. **Carried forward:** iOS device registration (`eas device:create`), Dependabot PR #97 (8 moderate npm advisories; only on the owner's word), Supabase Pro, EDGE-01 to EDGE-03, the email provider, legal review, and the App Store.

## Pending — engineering

1. **W2b, claim start: spec first, for approval.** The findings are unchanged from the 2026-09-26 close-out:
   - claimant sign-in (none in the app);
   - the claimant portal session (concealed on the Preview);
   - the claim-screen runtime (the bootstrap passes none);
   - a sheet-key handoff signer (the server verifies with the sheet-derived Ed25519 key);
   - the handoff routes on the Preview (no override yet).
2. **After the phone run:** confirm the sheet-check `expo/fetch` adapter works on the device.
3. **Later:** W3, the 7B reviewer console, and production readiness (W4–W5).

## Tooling notes

- **Hosted acceptance from the cloud container:** it works against the branch alias. `preview-api.sanduqkin.com` isn't reachable from the container (TLS fails there), and it's behind the Vercel login anyway.
- **Merging through the GitHub tools:** `expectedHeadSha` must be the full 40-character SHA.
- **Clock-skew reproduction:** a Node `--import` preload that shifts `Date` was used. The harness's own TOTP codes follow the shifted clock, so a fast clock over about 30 seconds fails at sign-in rather than in the product.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault`. Check out `claude/gifted-turing-lm2en4` and read `docs/handoff/2026-09-29-claimant-w2a-phone-access-session-close.md`, then the 2026-09-26 close-out and `CLAIM_HANDOFF.md`. Confirm `main` is at or after `5edc637` and that `claimant-preview` equals `main`. Ask me:
> - whether the Android keystore, the Preview app build and the phone run are done;
> - whether you should create a synthetic test-owner account for the phone run.
>
> Record any phone evidence, then remind me to delete the Preview app bypass and rotate the tokens. Then write the W2b claim-start spec for my approval. Docs go with code; PR watchers merge automatically when green.
