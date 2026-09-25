# Claimant 6C–6E session close — 2026-09-25

This is the current checkpoint and next-session opener. It supersedes earlier same-day entries.

## Owner decisions (Shahbaz Malik)

1. **One launch, with the claimant handover included.** The claimant handover is the product's core selling point, so the owner vault will not launch on its own first. Go-live waits until the claimant feature is ready.
2. **Sole approver for code and launch.** Shahbaz Malik is the only approver for the codebase and the go-live decision. Legal review is still sought for public documents (legal pages, privacy policy, terms). Claude remains a non-human engineering assistant and cannot approve.
3. **Offline-code material distribution.** The owner's printed emergency sheet carries a QR payload (`SKQ2.`) containing the locator, the client secret, the KDF profile and the record binding. Implemented in Slice 6E.
4. **Open decision: claim reviewers.** Slices 3E/3F enforce two distinct human reviewer identities before any release, and Claude cannot be a reviewer of real claims. Before launch, choose one:
   - two human reviewers, with no code change; or
   - a single owner reviewer with extra safeguards (cooldown, dispute window, audit trail), delivered as a dedicated slice.

## Delivered

- **PR #91, merged at `f01e38c`.** The `image-size` security exception is retired: Metro is aligned on 0.84.5, and the production audit now has no allowlist.
- **PR #92, merged at `404945a`. Slice 6C, runtime fault-injection acceptance.** Bug fixed: the 5T portal-session client never aborted an in-flight request on cancel or close.
- **PR #93, Slice 6D: mobile-to-API reconciliation acceptance**, against the actual routes with a store modelled on the SQL. Bugs fixed:
  - the 5T client rejected every revoke, because the SQL returns the advanced session version;
  - the 6A kill switch deferred disposal by a microtask.

  At session close, one Android emulator run had failed in the unrelated owner-vault CRUD step. A comment was posted on the PR and one re-run was pending. Confirm #93 is green and merged before merging 6E.
- **Slice 6E, stacked on #93: emergency sheet payload and the first claimant screen.**
  - A strict `SKQ2.` sheet codec in shared-types.
  - A claim-flow controller over a narrow bootstrap handle.
  - The `app/claim/offline-code` screen, provided by the root layout through context.
  - The normal app mounts the inert bootstrap, so the handle is always null and the screen shows "unavailable". Launch controls stay false/false/engaged.

## Remaining before go-live (rough order)

1. Owner-side sheet generation and printing, and the camera QR scanner (a native dependency and a new build).
2. Further claimant screens: registered next-of-kin invitation, evidence upload, dashboard, retrieval and local open.
3. The reviewer decision.
4. Hosted MFA, which needs Supabase Pro.
5. Production native custody and signing (Secure Enclave and App Attest, with physical-device evidence).
6. A transactional email provider.
7. Real-PostgreSQL race, RLS and replay acceptance, which needs Docker.
8. Backup/restore, deletion, observability and rollback; then a frozen release candidate and a readiness report.

Owner-held non-code items: legal review of public documents, Supabase Pro, EDGE-01 to EDGE-03, the production domain, an email provider and the App Store release.

## Next-session opener

> Continue the Sanduqkin claimant work in `shahbaz242630/Document-Vault`. Read `docs/handoff/2026-09-25-claimant-6c-6e-session-close.md`, `CLAIM_HANDOFF.md`, and the 6C/6D/6E specs and verification records. First confirm PR #93 (6D) and the 6E PR are green and merged in order, with their heads on `main`; if not, drive them to green and ask me before each merge. Then propose the next slice. Recommended: owner-side emergency-sheet generation plus the camera QR scanner, or my reviewer decision if I have made it. Write its spec for my approval before coding. Use a PR watcher for CI rather than polling.
