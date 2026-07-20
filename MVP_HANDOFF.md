# Sanduqkin MVP Website And Claimant Portal Handoff

Last updated: 2026-07-20 (Asia/Dubai)

## Session Opener

> Read `HANDOFF.md`, `SECURITY_HANDOFF.md`, and this document before starting MVP website work. The approved direction is a separate Next.js web application in the existing monorepo, deployed as its own Vercel project, with `sanduqkin.com` for the public site, `app.sanduqkin.com` for the isolated claimant portal, and `api.sanduqkin.com` for the canonical Hono API shared with the mobile app. Hostinger remains the registrar/DNS provider and Supabase remains the identity and encrypted-data platform. Protected development will continue against the existing Free Frankfurt Supabase project plus the local Supabase stack; no second hosted project or plan upgrade is required while building. A Supabase Pro upgrade, managed single-session activation, backup review, and cross-client displacement verification are mandatory before Sanduqkin is declared production-ready or external users are onboarded. MVP Phases 1 and 2 are merged and production-verified. MVP Phase 3 is implemented and protected-preview-verified on branch `codex/mvp-landing-legal`; publication is blocked pending owner design/content approval and resolution of `apps/web/LEGAL_CONTENT_REVIEW.md`. Live trusted-recipient, claimant, activation, or release functionality remains gated by the main release/security requirements and by the unresolved release-authority decision in this handoff.

## Purpose And Authority

This handoff is the durable source of truth for the Sanduqkin website MVP and the future claimant portal. It records:

- the repository and live-infrastructure findings verified before implementation;
- the agreed hosting, domain, API, identity, and zero-knowledge architecture;
- the two intended claimant routes;
- security, privacy, legal, resilience, scaling, cost, and performance constraints;
- unresolved decisions that block live data release;
- small implementation phases with explicit build, test, and exit gates; and
- the startup checklist a future session needs to continue without reconstructing prior discussions.

The phase numbers in this document describe the **website/claimant MVP track**. They do not replace the product phases in `HANDOFF.md` or `Vault_BRD_v1.0.md`.

## Slice Execution Rule

Every phase must follow this sequence:

1. Re-read the three active handoffs and inspect the current branch and working tree.
2. Confirm the phase scope and its non-goals.
3. Build only that narrow slice.
4. Add or update proportionate automated tests and security guards.
5. Run the phase verification plus the repository-wide checks affected by the change.
6. Inspect the diff for secrets, plaintext sensitive data, unrelated changes, and scope creep.
7. Record the result and any residual risk in this handoff.
8. Stop and obtain owner review before beginning the next phase.

Do not combine multiple phases merely because context remains available. A phase is complete only when its exit gate has evidence.

## Owner Sequencing Decision: Core Flow Before Publication

**Recorded:** 2026-07-19 (Asia/Dubai)

The owner has directed that the unresolved Phase 3 legal and publication work be parked while engineering validates the core product flow. This changes the execution order, but it does not convert draft legal content into approved content and does not authorize public publication.

- Phase 3 implementation and technical preview verification remain complete.
- The unresolved items in `apps/web/LEGAL_CONTENT_REVIEW.md` remain open and must be completed before public-domain publication or store use of the web legal/deletion URLs.
- Protected, non-production engineering may continue to validate core connectivity and product flow using fake or isolated test data.
- `sanduqkin.com`, `www.sanduqkin.com`, and other public production surfaces must not publish the draft legal documents as effective terms until the parked review is resumed and approved.
- `/claim` must remain inactive for real users. No production claimant data, evidence collection, data release, or representation of legal entitlement is authorized by this sequencing decision.
- Zero-knowledge, authentication, authorization, RLS, threat-model, cryptographic-review, and release-authority gates remain mandatory. They are engineering and security controls, not documentation work that can be deferred to launch.
- Work may be implemented in smaller protected proof-of-concept slices where each slice states its non-production boundary and has an explicit rollback or removal path.

The connected-core boundary has now been proven through protected mobile/web encrypted-vault parity slices and a complete schema-driven owner-vault category registry. All 17 current vault asset types use the same reviewed contract on mobile and web. Future registry changes still require review; do not interpret this automation as authority to publish, migrate production data, or activate claimant flows.

## Revised MVP Core Engine Direction

**Recorded:** 2026-07-19 (Asia/Dubai)

The owner clarified that the MVP web application is not only a claimant portal. It must also provide an owner vault experience connected to the same Sanduqkin account and encrypted records used by the mobile app.

### Owner Web Vault

- A user signs into web and mobile with the same Supabase identity.
- Web and mobile operate on the same `vault_key_material` and `vault_assets` records; the web application must not create a parallel vault or second source of truth.
- Web mirrors the supported mobile owner workflow, including listing, viewing, adding, updating, soft deleting, restoring, and permanently deleting encrypted records.
- Vault plaintext is encrypted and decrypted only in the active client. The web server, Hono API, Vercel, and Supabase must receive ciphertext and safe metadata only.
- The browser derives the KEK and unwraps the MEK locally. A raw password, KEK, or MEK must not be sent to the Hono API, stored in logs, or persisted in browser `localStorage`, `sessionStorage`, IndexedDB, cache storage, or service-worker storage.
- Authenticated pages and responses are dynamic, private, and `no-store`. Browser key material is cleared on lock, sign-out, timeout, session displacement, page lifecycle boundaries where practical, and fatal errors.
- Shared types, validation, envelope versions, associated-data rules, and record limits must be reused across mobile and web rather than copied into divergent implementations.

### One Active Login

- Product intent: the most recent successful sign-in becomes the user's only active session across web and mobile; an older client is displaced and returns to a locked/signed-out state.
- Supabase Pro's `Single session per user` control is the approved managed session-limit mechanism for production readiness. The existing project is currently on the Free plan, so this control must not be claimed as active during development. Upgrade the existing project before the production-readiness exit gate, enable and verify the managed control, and do not substitute a custom session mechanism without a new recorded owner/security decision. Even with the managed control, an older JWT may remain usable until its next validity check or refresh.
- This control is not instantaneous: an already issued access JWT can remain usable until expiry. The product must not claim immediate displacement unless additional server-side checks prove it.
- Set a deliberately short but supportable access-token lifetime, never below Supabase's recommended five-minute minimum solely to simulate instant logout.
- Sensitive Hono API operations must verify the user server-side and, where supported, validate the JWT `session_id` against the active Auth session before acting.
- Both clients must handle refresh failure/session displacement without retaining decrypted state. Sign-out semantics must be explicit; do not accidentally use global sign-out where only the active client should sign out unless the product intentionally wants every session revoked.
- A protected integration test must prove mobile-to-web and web-to-mobile displacement behavior, including the bounded JWT-expiry window.

### Approved Free-Tier Development And Production Upgrade Gate

**Recorded:** 2026-07-20 (Asia/Dubai)

The owner approved continued engineering without upgrading Supabase and without creating another hosted Supabase project. This is a development-environment decision, not a production-readiness exception.

- Use the existing Free Supabase project in `eu-central-1` for narrowly controlled mobile/web integration checks. Web and mobile must continue to share this one identity and encrypted-vault source of truth.
- Use the local Supabase stack for schema development, migration rehearsal, destructive cases, RLS attacks, and repeatable database-security tests before applying an append-only migration to the hosted project.
- Use dedicated test identities and synthetic or uniquely tagged encrypted records for new hosted verification. Do not use the owner's normal account for session-displacement tests, and clean up tagged rows after evidence is recorded.
- Keep hosted changes backward-compatible with the installed TestFlight build. Review any project-wide Auth, JWT, email, or RLS change for its effect on existing mobile sessions before applying it.
- Take and verify a manual off-site logical database backup before material hosted schema work while the project remains Free. Free-tier development must not be represented as having managed production backups or a production recovery objective.
- Keep Vercel previews protected and keep real claimant intake, evidence, release, and `/claim` activation disabled. No production claimant data is permitted under this decision.
- Supabase dashboard inspection on 2026-07-20 confirmed that the organization and project are on `Free`; `Enforce single session per user`, time-boxed sessions, and inactivity timeout are disabled; and the dashboard states that user-session configuration is available only on Pro and above. Refresh-token replay detection remains available and enabled. No dashboard setting was changed. The owner refreshed the project overview immediately afterward and confirmed the project health signal was healthy.
- Before any production-readiness declaration or onboarding of external authenticated users, upgrade the existing project to Pro, confirm managed backups and retention, enable the approved single-session setting, select a supportable JWT lifetime, and pass protected mobile-to-web and web-to-mobile displacement tests including the bounded old-JWT window and decrypted-state cleanup.
- Static public-site publication may proceed through its own legal and Phase 4 gates because it has no Supabase dependency. This exception does not permit the authenticated vault, claimant portal, or live claim functionality to be called production-ready before the Supabase upgrade gate passes.

### Claimant Document Intake And Release

- Claimant intake is a separate origin, role, schema, API capability, and storage boundary from the owner vault.
- Today's V1 emergency code cannot locate a grant safely. Claim initiation requires the approved V2 split format: a public locator plus a separate high-entropy secret that remains client-only.
- A claimant must authenticate, enroll required MFA, pass locator/possession checks, and receive an authorized claim-specific upload capability before submitting evidence.
- Evidence uploads must use a private, isolated quarantine bucket with randomized object names, allowlisted content types, strict size/count limits, no overwrite, malware scanning, safe metadata, retention/deletion controls, and no public or long-lived download URL.
- Storage RLS must bind each object to the claimant and claim. The owner vault must have no policy path to claimant evidence, and a claimant must have no policy path to `vault_assets`, `vault_key_material`, or another claim.
- Evidence documents are intentionally server-visible PII unless a later review chooses an encrypted review workflow. They are not covered by the normal vault zero-knowledge claim and require a separate privacy, operator-access, incident, and retention model.
- Uploading evidence or possessing a code never authorizes release. Release still requires the approved identity, evidence, challenge/cooldown, authority, audit, and state-machine gates.
- Released vault information remains ciphertext plus claimant-specific sealed key material and is decrypted locally into a read-only claimant view. The server must never decrypt the owner's vault.

### Revised Engineering Order

1. Shared-engine design and contracts: extract/reuse safe record, crypto-envelope, validation, and capability types without changing production behavior.
2. Web authentication proof: PKCE/cookie session handling, server verification, private/no-store behavior, and single-session displacement using non-production identities.
3. Web crypto compatibility proof: unwrap existing mobile-created key material and decrypt a ciphertext-only fixture locally in a Web Worker; do not persist key material.
4. Owner web vault vertical slice: one representative record category with list/create/read/update/delete against isolated Supabase data and existing RLS.
5. Expand owner web parity across supported mobile categories using shared schemas and regression vectors.
6. Claim V2 protocol and threat-model approval, followed by schema/RLS/API contracts.
7. Quarantined claimant evidence upload foundation using fake documents and non-production claims only.
8. Release-state machine and local read-only claimant retrieval only after release-authority approval.

Each step retains the slice execution rule and must stop at its own exit gate. Public website/legal publication can resume independently before launch.

### Core Engine Evidence: Web Authentication Foundation

**Implemented locally on 2026-07-19:**

- Added environment-gated Supabase browser and server clients to `apps/web` using the repository-pinned `@supabase/supabase-js` `2.108.2` and compatible `@supabase/ssr` `0.10.0`.
- Added browser-direct password sign-in so the password is submitted to Supabase Auth and not to a Sanduqkin/Vercel server action.
- Added cookie-backed session refresh through the Next.js 16 request proxy and server-side `getClaims()` verification for the dynamic `/vault` route.
- Authenticated routes are dynamic and proxy responses are marked `private, no-store` with `Pragma: no-cache`.
- The owner directed on 2026-07-19 that web/mobile validation use the same existing Supabase project rather than a separate development project. The existing project URL and browser-safe publishable key are now configured only in ignored `apps/web/.env.local`; no service-role or other privileged credential was read or stored in the repository.
- This foundation does not yet enable vault decryption or CRUD and does not prove the live single-session setting. Those remain separate exit gates.

### Core Engine Evidence: Mobile/Web Crypto Compatibility V1

**Implemented and locally verified on 2026-07-19:**

- Added a deterministic, explicitly test-only compatibility vector representing the current mobile format: Argon2id v1.3, three operations, 256 MiB memory, 16-byte salt, 32-byte KEK/MEK, XChaCha20-Poly1305, `vault:mek-wrap` MEK associated data, and `vault-asset:{assetType}` record associated data.
- Added an independent web implementation that validates the exact KDF parameters, unwraps the mobile-format MEK, decrypts mobile-format records, and encrypts web updates into the same envelope.
- Added a stateful Web Worker boundary that retains the active MEK only in worker memory, refuses operations while locked, replaces and zeroes an old MEK on unlock, and zeroes it on lock.
- The web test suite decrypts the mobile-format vector, round-trips a web update, proves the serialized envelope excludes updated plaintext, rejects a wrong password, rejects associated-data substitution, and verifies byte-array clearing.
- The unchanged mobile implementation independently decrypts the same shared fixture, providing a cross-client regression gate rather than a web-only self-test.
- A real Chrome browser run through the browser extension completed Argon2id unlock and fixture decryption inside the worker on a clean local origin in approximately 3.84 seconds. It created no cookie or local-storage entry, made no external request, and created no application session-storage entry. The temporary proof route was removed after verification.
- Web tests, focused mobile compatibility test, web/mobile typecheck, repository lint, web production build, repository security guard, and mobile secret scan passed.

**Residual risks and next gate:**

- The measured KDF result is one desktop-browser observation, not the required representative-device benchmark. iPhone, Android, low-memory, and additional desktop measurements remain required before broad activation.
- JavaScript strings cannot be reliably zeroed; minimize password lifetime and references, and keep the worker protocol narrow.
- At the compatibility-proof gate, the worker core was not yet connected to key-material rows or UI unlock controls; the following recorded slice implements that connection locally while retaining a non-production activation gate.

### Core Engine Evidence: Owner Web Vault Vertical Slice

**Implemented and live-tested against the existing shared project on 2026-07-19:**

- Connected the authenticated `/vault` UI to the existing `vault_key_material` and `vault_assets` contracts through the browser Supabase client and existing owner-only RLS model.
- Added a worker client that owns unlock, decrypt, encrypt, and lock requests; it does not expose the MEK to the React component.
- Added a `bank_account` vertical slice supporting local unlock, encrypted list/view, encrypted create/update, soft deletion, restore, and confirmed permanent deletion.
- The password input is cleared immediately after dispatching the unlock operation. Plaintext form fields are sent only to the local worker; persistence receives ciphertext, nonce, type, ID, and timestamps.
- Repository regression tests map the existing mobile row format and assert that serialized persistence calls contain ciphertext but no `institutionName` or `lastFourDigits` fields.
- The route remains dynamic, authenticated, `noindex`, and behind the private/no-store session proxy.
- Web tests (24), web typecheck, repository lint, production build, repository security guard, mobile-secret scan, and the high-severity production dependency threshold passed.
- Fixed the browser configuration boundary so Next.js statically embeds the two browser-safe `NEXT_PUBLIC_*` values; the previous computed `process.env` access caused the browser client to report that sign-in was temporarily unavailable even though the server was configured.
- Owner-entered credentials authenticated successfully and reached the protected `/vault` route. The browser worker unlocked the existing mobile-format key material and decrypted an existing encrypted bank-account row, proving the mobile-to-web compatibility direction without modifying that row.
- A uniquely tagged temporary encrypted row completed create, read, update, soft delete, restore, and confirmed permanent delete through live owner-only RLS. Absence after permanent deletion was verified.
- A second encrypted row titled `WEB TO MOBILE TEMP 20260719` was created on web, appeared and decrypted successfully in TestFlight build `3`, then was soft-deleted and permanently deleted from web. The live repository refresh returned zero matching rows with no error, and the browser worker was locked afterward. This completes the web-to-mobile compatibility direction and test-data cleanup.

**Remaining exit evidence:**

- The local web app uses the existing project's URL and browser-safe publishable key from ignored `apps/web/.env.local`; no service-role key is present in browser or repository configuration.
- The installed TestFlight build `2` had been produced without Supabase public configuration and returned `Supabase is not configured yet.` EAS production and the protected GitHub `Release` environment now contain the existing project's public URL and publishable key, and replacement build `3` authenticated successfully on the owner's physical iPhone.
- Protected GitHub run `29695865266` passed its SBOM and signed-release gates. EAS iOS build `9055529c-508a-415d-872a-08708e533613`, app `1.0.0` build `3`, completed and submission `15150bed-c453-4ac3-bf21-31072b6703c6` was accepted and processed by App Store Connect. Transient signing files were removed successfully.
- Build `3` was cleared under the existing standard-encryption, France-excluded compliance decision and deliberately assigned to `GCC Internal Testers`; automatic distribution remains disabled. Physical installation, password sign-in, vault unlock, web-to-mobile record visibility, and tagged test-row cleanup all passed.
- Before the live authenticated-web exit gate, add the exact web redirect origin to Supabase Auth, upgrade the existing project to Pro, enable the managed single-session setting, and pass the cross-client displacement tests. Do not enable a global Auth change until its effect on current mobile/TestFlight sessions is reviewed. Protected Free-tier engineering may continue under `Approved Free-Tier Development And Production Upgrade Gate` above.

### Core Engine Evidence: Full Bank-Account Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection of the initial vertical slice found that the web editor exposed only `institutionName` and `lastFourDigits`, while the mobile bank-account contract also requires country, currency, approximate value range, document location, and institution contact. Updating a full mobile-created record through that partial web form could have discarded fields from the newly encrypted payload.
- Moved the complete bank-account validation contract and value-range enumeration into `@vault/shared-validation`; mobile and web now consume the same schema instead of maintaining divergent validation rules.
- Expanded the web form, edit population, and summary to cover the complete mobile bank-account field set while retaining the local-worker encryption boundary.
- Web updates now replace the known bank-account fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields. This prevents the current web client from silently erasing forward-compatible mobile fields during an edit.
- Corrected the unlock copy to state accurately that the vault password entered there is used only by the local crypto worker and is not submitted to Supabase or the Sanduqkin web server by that form.
- Added shared-contract normalization/validation tests and web regression tests for full field parity, optional-field clearing, and preservation of an unknown future mobile field.
- No Supabase schema, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 344 passed/2 protected live tests skipped, web 26 passed, shared validation 12 passed, and API 28 passed.
- Repository typecheck and lint passed; focused mobile bank-account, shared-validation, and web tests/typechecks passed.
- The web production build passed with public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed after the enlarged component was split to retain the repository function-size limit.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase container was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.

**Completed by the next recorded slice:** the single additional category selected was `card`; its bounded evidence follows.

### Core Engine Evidence: Full Card Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Moved the complete mobile `card` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now consume the same required title, issuer, and country fields plus the same optional card type, four-digit suffix, support contact, and notes fields.
- The shared contract permits an omitted suffix but accepts only exactly four ASCII digits when one is supplied. Partial values and full card numbers are rejected, and the web form explicitly tells the owner never to enter a full card number.
- Generalized the ciphertext repository read path from a bank-only method to category-scoped `listAssets(assetType)` calls, retaining the existing owner-only Supabase/RLS contract and ciphertext-only persistence boundary.
- Extended the authenticated owner workspace with encrypted card create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer never receives the MEK.
- Card edits replace known card fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so an older web client does not erase fields introduced by a later mobile version.
- Added shared validation, mobile payload, web payload, and repository regression tests covering normalization, exact four-digit enforcement, full-number rejection, mobile/web field parity, category-scoped ciphertext reads, optional-field clearing, and forward-field preservation.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 346 passed/2 protected live tests skipped, web 28 passed, shared validation 14 passed, and API 28 passed (416 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile card, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live Supabase card row, protected preview, TestFlight cross-client card edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `investment`; its bounded evidence follows.

### Core Engine Evidence: Full Investment Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Moved the complete mobile `investment` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, institution, account type, last-four suffix, country, currency, and approximate value range plus the same optional document location, institution contact, and notes.
- Reused the shared approximate-value enumeration and constrained account type to `brokerage`, `retirement`, `mutual_fund`, or `other`. The shared contract accepts exactly four ASCII digits for the account suffix and rejects partial or full investment account numbers.
- Extended the authenticated owner workspace with encrypted investment create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Investment edits replace known investment fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK. The form explicitly tells the owner never to enter a full investment account number.
- Added shared validation, web payload, and repository regression coverage for complete mobile/web field parity, normalization, supported account types, exact suffix enforcement, full-number rejection, category-scoped reads, optional-field clearing, and unknown-field preservation. Existing mobile investment tests now exercise the shared schema.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 346 passed/2 protected live tests skipped, web 31 passed, shared validation 16 passed, and API 28 passed (421 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile investment, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser investment flow, hosted Supabase investment row, protected preview, TestFlight cross-client investment edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `property`; its bounded evidence follows.

### Core Engine Evidence: Full Property Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Moved the complete mobile `property` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, address, country, and approximate value range plus optional mortgage provider, document location, property contact, and notes.
- Reused the shared approximate-value enumeration and retained the mobile rule that blank optional values are normalized away. Property records do not request or store an account-number suffix.
- Extended the authenticated owner workspace with encrypted property create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Property edits replace known property fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Refactored edit-form population to set controls safely by name. This preserves existing bank/card/investment behavior while allowing property and later categories that do not contain an account-number control.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added shared validation, web payload, and repository regression coverage for complete mobile/web field parity, normalization, required-field enforcement, category-scoped reads, optional-field clearing, and unknown-field preservation. Existing mobile property tests now exercise the shared schema.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 346 passed/2 protected live tests skipped, web 34 passed, shared validation 18 passed, and API 28 passed (426 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile property, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser property flow, hosted Supabase property row, protected preview, TestFlight cross-client property edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `insurance`; its bounded evidence follows.

### Core Engine Evidence: Full Insurance Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Moved the complete mobile `insurance` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, provider, policy type, four-digit policy suffix, country, and approximate value range plus optional document location, provider contact, and notes.
- Reused the shared approximate-value enumeration, constrained policy type to `life`, `health`, `property`, `auto`, or `other`, and retained the exact four-ASCII-digit suffix rule. Partial and full policy numbers are rejected, and the web form explicitly tells the owner never to enter a full policy number.
- Extended the authenticated owner workspace with encrypted insurance create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Insurance edits replace known insurance fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added shared validation, web payload, and repository regression coverage for complete mobile/web field parity, normalization, supported policy types, exact suffix enforcement, full-number rejection, category-scoped reads, optional-field clearing, and unknown-field preservation. Existing mobile insurance tests now exercise the shared schema.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 346 passed/2 protected live tests skipped, web 37 passed, shared validation 20 passed, and API 28 passed (431 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile insurance, and web test/typecheck/lint checks also passed.
- An initial web run executed concurrently with six other focused commands and one Argon2 compatibility test exceeded its five-second limit. The web suite passed all 37 tests when rerun alone, and the subsequent sequential workspace suite also passed all 37; this was resource contention, not a functional failure.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser insurance flow, hosted Supabase insurance row, protected preview, TestFlight cross-client insurance edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `crypto`; its bounded evidence follows.

### Core Engine Evidence: Full Crypto-Reference Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Moved the complete mobile `crypto` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, crypto type, short wallet identifier, country, and approximate value range plus optional exchange/platform, access-instruction location, and notes.
- Reused the shared approximate-value enumeration and constrained crypto type to `bitcoin`, `ethereum`, or `other`.
- Tightened the shared wallet-identifier rule to at most 16 characters, sufficient for a short owner label or the last four wallet characters while rejecting complete Ethereum and other ordinary wallet addresses. Mobile and web now enforce the same rule.
- The web form explicitly prohibits seed/recovery phrases, private keys, passwords, and complete wallet addresses. It asks only for a short identifier and the location of separately protected access instructions; it does not add fields for secret recovery material.
- Extended the authenticated owner workspace with encrypted crypto-reference create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Crypto-reference edits replace known crypto fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added shared validation, mobile, web payload, and repository regression coverage for complete mobile/web field parity, normalization, supported crypto types, full-address rejection, category-scoped reads, optional-field clearing, and unknown-field preservation.
- Moved the crypto form into a focused component after the Phase 1 guard detected that the owner workspace had reached 519 lines; the guarded owner file is again below the 500-line ceiling.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 347 passed/2 protected live tests skipped, web 40 passed, shared validation 22 passed, and API 28 passed (437 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile crypto, and web test/typecheck/lint checks also passed.
- The deliberate 256 MiB Argon2 negative test performs two unlock attempts and repeatedly exceeded Vitest's generic five-second timeout after the mobile suite. Its individual timeout was raised to 15 seconds without changing KDF parameters; the subsequent full workspace suite passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser crypto-reference flow, hosted Supabase crypto row, protected preview, TestFlight cross-client crypto edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `pension`; its bounded evidence follows.

### Core Engine Evidence: Full Pension Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found a mobile contract defect: the pension form accepted `pensionContact` and the edit screen read it, but `createPensionAssetPayload` omitted it from the encrypted fields. The mobile payload builder now preserves that contact instead of silently discarding it.
- Moved the corrected complete mobile `pension` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, pension provider, four-digit account suffix, country, and approximate value range plus optional document location, provider contact, and notes.
- Reused the shared approximate-value enumeration and exact four-ASCII-digit suffix rule. Partial and full pension policy/account numbers are rejected, and the web form explicitly tells the owner never to enter a full number.
- Extended the authenticated owner workspace with encrypted pension create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Pension edits replace known pension fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Extracted the pure record-summary and category-label formatters from the owner component into a focused module, added pension formatting, and added regression coverage for the new pension summary plus existing/fallback labels. This keeps the main component comfortably inside the repository line limit as categories expand.
- Added shared validation, corrected mobile payload, web payload, formatter, and repository regression coverage for complete mobile/web field parity, provider-contact persistence, normalization, exact suffix enforcement, full-number rejection, category-scoped reads, optional-field clearing, and unknown-field preservation.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 347 passed/2 protected live tests skipped, web 45 passed, shared validation 24 passed, and API 28 passed (444 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile pension, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser pension flow, hosted Supabase pension row, protected preview, TestFlight cross-client pension edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `subscription`; its bounded evidence follows.

### Core Engine Evidence: Full Subscription Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found a mobile contract defect: the subscription form accepted `subscriptionContact` and the edit screen read it, but `createSubscriptionAssetPayload` omitted it from the encrypted fields. The mobile payload builder now preserves that contact instead of silently discarding it.
- Moved the corrected complete mobile `subscription` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now share the same required title, service name, subscription type, country, and approximate monthly cost range plus optional account-information location, service contact, and notes.
- Added shared subscription-type and cost-range enumerations. Types are constrained to `streaming`, `software`, `utility`, or `other`; monthly cost ranges are constrained to the existing mobile values.
- Extended the authenticated owner workspace with encrypted subscription create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Subscription edits replace known subscription fields, allow known optional fields to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added subscription summary and deleted-record labeling to the extracted formatter module, with regression coverage for service, type, country, and monthly cost display.
- Added shared validation, corrected mobile payload, web payload, formatter, and repository regression coverage for complete mobile/web field parity, service-contact persistence, normalization, supported types/cost ranges, category-scoped reads, optional-field clearing, and unknown-field preservation.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 347 passed/2 protected live tests skipped, web 49 passed, shared validation 26 passed, and API 28 passed (450 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile subscription, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic. The build was slower than prior runs under temporary local machine load but completed without error.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The first production dependency-audit request hit a transient DNS failure resolving the npm registry; an immediate retry succeeded and passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser subscription flow, hosted Supabase subscription row, protected preview, TestFlight cross-client subscription edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `document_location`; its bounded evidence follows.

### Core Engine Evidence: Full Document-Location Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile document-location payload contract. The mobile form already persisted every accepted field: required title, document type, location, and country plus optional custodian and notes.
- Moved that complete mobile `document_location` validation contract into `@vault/shared-validation`; mobile payload construction and the web editor now consume the same schema. Document types are constrained to `will`, `deed`, `passport`, or `other`.
- Extended the authenticated owner workspace with encrypted document-location create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Document-location edits replace known fields, allow the optional custodian to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added a focused document-location form component rather than expanding the main owner component past the repository limit; the main component remains at 485 lines. Added document-type-aware active-record summaries and deleted-record labeling.
- Added shared-validation, web-payload, formatter, and repository regression coverage for full mobile/web field parity, normalization, supported document types, category-scoped reads, optional-field clearing, and unknown-field preservation. The existing mobile document-location suite remains the mobile contract regression evidence.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 347 passed/2 protected live tests skipped, web 53 passed, shared validation 28 passed, and API 28 passed (456 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile document-location, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command could not connect because Docker Desktop's local Supabase engine was not running. No database, migration, schema, or RLS change occurred in this slice, so this does not block the client/shared-contract result; the database guard remains mandatory before any later database change.
- This is local implementation evidence only. No live browser document-location flow, hosted Supabase document-location row, protected preview, TestFlight cross-client document-location edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `contact`; its bounded evidence follows.

### Core Engine Evidence: Full Contact Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile contact payload contract. The mobile form already persisted every accepted field: required name, relationship, and country plus optional phone, email, and notes.
- Moved that complete mobile `contact` validation contract and relationship enumeration into `@vault/shared-validation`; mobile payload construction and the web editor now consume the same schema. Relationships are constrained to `lawyer`, `accountant`, `employer`, `embassy`, or `other`.
- Extended the authenticated owner workspace with encrypted contact create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Contact edits replace known contact fields, allow optional phone and email values to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Added a focused contact form component so the main owner workspace remains within the repository limit at 499 lines. Added relationship-aware active-record summaries and deleted-record labeling.
- Added shared-validation, web-payload, formatter, and repository regression coverage for full mobile/web field parity, normalization, supported relationships, category-scoped reads, optional-field clearing, and unknown-field preservation. The existing mobile contact suite remains the mobile payload regression evidence.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 347 passed/2 protected live tests skipped, web 57 passed, shared validation 30 passed, and API 28 passed (462 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile contact, and web test/typecheck/lint checks also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase database-security command initially could not connect because the expected project stack was not running. During the following vehicle slice, the stack was started with the repository's CI-compatible workdir, every migration was applied in order, and both the live catalog security check and RLS attack suite passed.
- This is local implementation evidence only. No live browser contact flow, hosted Supabase contact row, protected preview, TestFlight cross-client contact edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `vehicle`; its bounded evidence follows.

### Core Engine Evidence: Full Vehicle Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile vehicle payload contract. The mobile expanded-asset form already persisted every accepted field: required title, vehicle type, make/model, and country/state plus optional registration plate, document/spare-key location, and notes.
- Moved that complete `vehicle` validation contract into `@vault/shared-validation`; the mobile expanded-asset payload builder and web editor now consume the same normalized schema.
- Extended the authenticated owner workspace with encrypted vehicle create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Vehicle edits replace known vehicle fields, allow optional registration and document-location values to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Extracted the existing bank-account form into a focused component before adding the focused vehicle form. The main owner workspace remains within the repository limit at 494 lines.
- Added shared-validation, mobile-payload, web-payload, formatter, and repository regression coverage for full mobile/web field parity, normalization, required fields, category-scoped reads, optional-field clearing, and unknown-field preservation.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 349 passed/2 protected live tests skipped, web 61 passed, shared validation 32 passed, and API 28 passed (470 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile vehicle, and web tests also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- Docker Desktop was running but the repository's local Supabase stack was absent. Started it with `supabase start --workdir supabase`, applied every repository migration in order using the same container contract as CI, and passed both `check:supabase-db-security` and `check:supabase-rls`. The local stack was stopped after verification; its local data volume was retained by the CLI.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- This is local implementation evidence only. No live browser vehicle flow, hosted Supabase vehicle row, protected preview, TestFlight cross-client vehicle edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `loan_debt`; its bounded evidence follows.

### Core Engine Evidence: Full Loan/Debt Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile loan/debt payload contract. The mobile expanded-asset form already persisted every accepted field: required title, lender, debt type, and country plus optional short reference/last-four, contact details, and notes.
- Moved that complete `loan_debt` validation contract into `@vault/shared-validation`; the mobile expanded-asset payload builder and web editor now consume the same normalized schema.
- Extended the authenticated owner workspace with encrypted loan/debt create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Loan/debt edits replace known fields, allow the optional reference and contact details to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- The web form tells the owner to store only a short reference or last four characters and never a full loan or account number. This retains the existing mobile contract while reducing the risk of unnecessary full-number entry.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Extracted the existing card form into a focused component before adding the focused loan/debt form. After a guard identified that edit-form population was one line over its function limit, the loan-specific population logic was moved into a focused helper; all size guards then passed and the main owner workspace remains at 498 lines.
- Added shared-validation, mobile-payload, web-payload, formatter, and repository regression coverage for full mobile/web field parity, normalization, required fields, category-scoped reads, optional-field clearing, and unknown-field preservation.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 351 passed/2 protected live tests skipped, web 65 passed, shared validation 34 passed, and API 28 passed (478 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile loan/debt, and web tests/typecheck also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed after the focused helper extraction.
- The local Supabase catalog security and RLS attack suites passed immediately before this slice against all applied repository migrations. No database, migration, schema, or RLS change occurred in the loan/debt slice; the local stack remained stopped after its prior verified shutdown with its data volume retained.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- This is local implementation evidence only. No live browser loan/debt flow, hosted Supabase loan/debt row, protected preview, TestFlight cross-client loan/debt edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** the single further category selected was `medical_care`; its bounded evidence follows.

### Core Engine Evidence: Full Medical-Care Contract Parity

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile medical-care payload contract. The mobile expanded-asset form already persisted its required title plus optional doctor/clinic, conditions/allergies, medications, health-insurance reference, emergency preferences, and notes.
- Moved that complete `medical_care` validation contract into `@vault/shared-validation`; the mobile expanded-asset payload builder and web editor now consume the same normalized schema.
- Extended the authenticated owner workspace with encrypted medical-care create, list, view, update, soft delete, restore, and confirmed permanent delete behavior. Category reads remain scoped through `listAssets(assetType)`, and persistence still receives only ciphertext, nonce, type, ID, and timestamps.
- Medical-care edits replace known fields, allow every optional medical-care field to be cleared, and preserve unknown future encrypted fields so the current web client cannot silently erase later mobile fields.
- All health-related values remain inside the encrypted payload. They were not added as normalized metadata, logs, query values, or server-visible fields. The web form states that the sensitive details are encrypted locally before storage, and the compact active-record summary uses provider/insurance context without expanding conditions or medications.
- Unlock, decrypt, encrypt, and lock operations remain inside the local browser worker; the React layer does not receive the MEK.
- Extracted the existing investment form into a focused component before adding the focused medical-care form. After the phase guard found edit-form population one line over its function limit, the existing contact population logic was extracted to a helper; all guards then passed and the main owner workspace remains at 496 lines.
- Added shared-validation, mobile-payload, web-payload, formatter, and repository regression coverage for full mobile/web field parity, normalization, title enforcement, category-scoped reads, optional-field clearing, unknown-field preservation, and restrained summary output.
- No Supabase schema, migration, RLS policy, Auth setting, hosted row, environment variable, or production deployment changed in this slice.

**Verification:**

- Workspace tests passed: mobile 353 passed/2 protected live tests skipped, web 69 passed, shared validation 36 passed, and API 28 passed (486 passed in total).
- Repository typecheck and lint passed; focused shared-validation, mobile medical-care, and web tests/typecheck/lint also passed.
- The web production build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed after the helper extraction.
- The local Supabase catalog security and RLS attack suites passed immediately before the preceding client-only parity slices against all applied repository migrations. No database, migration, schema, or RLS change occurred in this medical-care slice; the local stack remains stopped with its data volume retained.
- The production dependency audit passed the high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- This is local implementation evidence only. No live browser medical-care flow, hosted Supabase medical-care row, protected preview, TestFlight cross-client medical-care edit, commit, or deployment was created in this bounded slice.

**Completed by the next recorded slice:** before adding another category, the owner approved a bounded automation foundation so reviewed mobile category contracts can drive the owner web workspace without repeating the same fields manually. The `contact` category was selected as the proof migration; its evidence follows.

### Core Engine Automation Foundation: Shared Schema-Driven Vault Categories

**Implemented and locally verified on 2026-07-20:**

- Added a platform-neutral registry to `@vault/shared-validation`. Each enrolled definition owns its asset type, version, singular/plural labels, field controls, field roles, defaults, mobile-safe input hints, Zod validation schema, compact-summary fields, and the explicit `encrypted_payload_only` security classification.
- Enrolled `contact` as the first proof category. Its mobile add form, mobile edit form, labels, defaults, keyboard hints, validation, normalization, and encrypted payload creation now derive from the shared definition rather than duplicate contact-specific contracts.
- The authenticated owner web workspace discovers every enrolled registry category automatically for form rendering, category-scoped reads, active-record sections, labels, validation, encrypted payload creation, edit population, and compact summaries. Adding a reviewed definition to the registry therefore makes that ordinary category contract visible to the web workspace without another hand-written web form or payload branch.
- The generic payload boundary replaces known fields, clears known optional fields when blank, and preserves unknown encrypted fields written by a newer client. The existing contact payload shape remains compatible, including the contact name in encrypted fields and as the record title.
- Added registry invariants that require unique category and field names, exactly one title field, no more than one notes field, summary fields limited to encrypted payload fields, a positive version, and the `encrypted_payload_only` classification. Web tests prove automatic category discovery and rendering; mobile tests prove that field/default/label changes flow from the same definition.
- Kept the trust boundary unchanged: the registry contains no key material, credentials, plaintext persistence, database calls, authorization logic, claimant logic, or deployment capability. Browser encrypt/decrypt/unlock/lock operations remain inside the local crypto worker, and Supabase still receives only the existing encrypted record envelope and permitted metadata.
- Extracted the legacy property and insurance forms into focused components after the repository guard identified the expanded owner workspace. The main workspace is now 484 lines and remains under the enforced 500-line limit.
- No Supabase schema, migration, RLS policy, Auth setting, hosted record, environment variable, production domain, legal content, claim route, commit, preview, or deployment changed in this automation slice.

**Deliberate automation limits:**

- This is a secure category-contract automation foundation, not an unrestricted mobile-screen-to-website copier. Only `contact` is enrolled today; the other existing web parity categories remain on their already verified explicit implementations until migrated one at a time.
- A brand-new category still requires a reviewed shared asset type and schema, any necessary database-enum migration and RLS verification, explicit mobile routing/navigation, focused compatibility tests, and owner/security approval before registry enrollment. Rich controls not yet represented by the registry require a reviewed renderer extension.
- Registry changes do not automatically commit, deploy, publish marketing/legal copy, alter App Store or Play Store releases, change Supabase, or expose a claimant feature. `/claim` remains informational and inactive, and all claimant/authentication/payment/crypto release gates remain unchanged.

**Verification:**

- Workspace tests passed: mobile 355 passed/2 protected live tests skipped, web 72 passed, shared validation 39 passed, and API 28 passed (494 passed in total).
- Repository typecheck and zero-warning lint passed. The web production build passed with public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed. The registry discovery, renderer, payload normalization, forward-field preservation, mobile derivation, and summary behavior have focused regression coverage.
- The production dependency audit passed the configured high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase catalog security and RLS attack suites passed immediately before the preceding client-only parity work against every applied repository migration. This automation slice made no database or policy change, so the stack was not restarted solely to repeat those unchanged checks.
- This is local implementation evidence only. No live browser automation flow, hosted Supabase contact write, TestFlight cross-client edit, commit, protected preview, or production deployment was created in this bounded slice.

**Completed by the next recorded slice:** `dependent_pet` was enrolled as the second schema-driven category, proving that the owner web workspace can acquire a further mobile contract through registry discovery without a category-specific web form or save branch. Its bounded evidence follows.

### Core Engine Evidence: Automated Dependent/Pet Registry Migration

**Implemented and locally verified on 2026-07-20:**

- Inspection found no defect in the existing mobile `dependent_pet` contract: required reference title, name, and relationship/type plus optional school/caregiver/vet contact, country, care instructions, and family notes.
- Added that complete normalized schema and its versioned `encrypted_payload_only` category definition to `@vault/shared-validation`. The definition distinguishes a standalone record title from contact's title-and-payload name behavior, preserving both existing ciphertext payload shapes without adding a duplicate dependent/pet title field.
- Replaced the dependent/pet-specific mobile field/default block with the shared mobile registry adapter. The existing add route and edit configuration now derive labels, controls, required fields, defaults, validation, normalization, initial edit values, and payload creation from the same shared definition.
- The authenticated owner web workspace discovered `dependent_pet` through the registry automatically. No dependent/pet-specific web form, payload builder, save branch, read list, edit-population helper, heading map, or formatter branch was added. Generic registry paths now provide encrypted create, category-scoped list/view, update, soft delete, restore, and confirmed permanent delete behavior.
- Dependent/pet edits replace known fields, allow optional values to be cleared, and preserve unknown future encrypted fields when written by the web client. The compact active-record summary shows name, relationship/type, care contact, and country without expanding care instructions or family notes.
- `dependent_pet` was already present in `@vault/shared-types` and in the applied Supabase `vault_assets.asset_type` constraint migration. No database schema, migration, RLS policy, Auth setting, environment variable, hosted row, or production deployment change was required.
- Added focused shared-registry, mobile add/edit payload, automatic web discovery/rendering, formatter, and repository coverage. The registry tests continue to enforce unique definitions/fields, title/notes roles, encrypted-summary boundaries, positive versions, and the `encrypted_payload_only` classification across both enrolled categories.

**Verification:**

- Workspace tests passed: mobile 358 passed/2 protected live tests skipped, web 73 passed, shared validation 40 passed, and API 28 passed (499 passed in total).
- Repository typecheck passed. The web production build passed with public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed. The owner workspace remains at 484 lines and below its enforced 500-line limit.
- The production dependency audit passed the configured high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- The local Supabase catalog security and RLS attack suites passed before these client-only registry migrations against all applied repository migrations. Because `dependent_pet` was already allowed and this slice changed no database or policy file, the stopped local stack was not restarted solely to repeat unchanged checks.
- This is local implementation evidence only. No live browser dependent/pet flow, hosted Supabase row, TestFlight cross-client edit, commit, protected preview, or production deployment was created in this bounded slice.

**Completed by the next recorded change:** the owner clarified that the intended result was a global owner-vault category system, not a foundation that still required manual category-by-category web work. The registry and both clients were therefore consolidated across the complete existing asset-type set.

### Core Engine Automation: Global Owner-Vault Category Consolidation

**Implemented and locally verified on 2026-07-20:**

- The platform-neutral `@vault/shared-validation` registry is now exhaustive for all 17 current asset types: `bank_account`, `card`, `investment`, `property`, `vehicle`, `insurance`, `crypto`, `pension`, `loan_debt`, `subscription`, `document_location`, `contact`, `medical_care`, `dependent_pet`, `business_interest`, `digital_account`, and `other`.
- Each definition is the shared source for the category labels, field labels and order, controls, options, defaults, required state, input hints, helper text, Zod validation and normalization, encrypted payload mapping, edit values, and safe compact-summary fields. `business_interest`, `digital_account`, and `other` now also have shared schemas rather than mobile-only contracts.
- Every mobile add route is a thin route declaration over one generic schema-driven add component. Mobile add forms, edit forms, payload creation, category labels, dashboard links, category lists, record details, recently deleted labels, and export labels all consume the registry. The exhaustive route map retains only reviewed navigation paths because adding a native screen route is an intentional product action.
- The authenticated owner web workspace now renders, validates, reads, creates, edits, summarizes, soft deletes, restores, and permanently deletes every registered category through generic paths. The former category-specific web form, payload, formatter, save, read, and edit-population branches were removed; compatibility wrappers delegate to the shared payload implementation where existing tests or imports require them.
- The generic payload boundary continues to replace known fields, clear known optional values when blank, and preserve unknown encrypted fields written by a newer client. Security-sensitive long-form fields such as medical notes, care instructions, credentials instructions, and business instructions are excluded from compact summaries.
- Registry checks now fail unless the definitions exactly cover `assetTypes`, every schema key exactly matches its registered fields, field names are unique, each category has exactly one title role and no more than one notes role, select defaults are valid, summaries reference payload fields only, versions are positive, and every definition is classified `encrypted_payload_only`.
- Adding or changing a field in an existing category now propagates to both mobile and web through the shared definition. Adding a brand-new asset type requires a reviewed shared type, schema and registry definition; the completeness checks fail until those pieces exist. A new native route path and any required database constraint migration/RLS verification remain deliberate reviewed steps, not silent automated infrastructure changes.
- This automation is global for owner-vault category contracts. It does not scrape or copy arbitrary mobile UI, automatically invent non-vault website features, commit, deploy, publish legal/marketing content, change App Store or Play Store releases, alter Supabase, or activate claimant behavior. `/claim` remains informational and inactive.
- No Supabase schema, migration, RLS policy, Auth setting, hosted record, environment variable, production domain, legal content, claimant route behavior, commit, preview, or deployment changed in this consolidation.

**Verification:**

- Workspace tests passed: mobile 361 passed/2 protected live tests skipped, web 73 passed, shared validation 40 passed, and API 28 passed (502 passed in total, 2 skipped).
- Repository typecheck and zero-warning lint passed. The production web build passed with all public routes static and `/login` plus `/vault` dynamic.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed. Focused tests prove exact registry completeness, schema/field equality, automatic mobile routes, generic mobile add/edit behavior, automatic web discovery/rendering, cross-client payload compatibility, safe summaries, and unknown-field preservation.
- The production dependency audit passed the configured high-severity threshold. Fourteen known moderate findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- After Docker was restarted, the missing local Supabase service images were restored and the retained local stack started successfully. The Supabase database catalog security check and RLS attack suite both passed against every applied repository migration. PostgreSQL emitted a local collation-version warning during the catalog check, but the security assertions passed; this consolidation changed no database or policy file.
- This is local implementation evidence only. No live browser/native global-category smoke matrix, hosted Supabase write, TestFlight cross-client edit, commit, protected preview, or production deployment was created in this consolidation.

**Completed by the next recorded change:** a fresh security and resilience review of the global automation found three pre-production gaps—mobile forward-field loss on edit, local/remote divergence after failed mobile persistence, and missing application-owned browser-vault security headers. The owner approved fixing all three; the hardened evidence follows.

### Core Engine Hardening: Mirroring Integrity And Browser Isolation

**Implemented and locally verified on 2026-07-20:**

- Mobile edit payload creation now receives the record's existing decrypted field map. Known fields are replaced or cleared through the current schema while unknown fields written by a newer client are preserved, matching the already verified web behavior.
- Mobile create, update, soft delete, restore, and permanent delete operations now reconcile the encrypted in-memory store from Supabase after a persistence exception. If reconciliation is unavailable, the affected local record is rolled back. A response-loss case is treated as successful only when the reconciled encrypted record or deletion state proves that the remote mutation was applied.
- Added focused regression tests for forward-field preservation and for rejected remote create, update, soft-delete, restore, and permanent-delete operations. The tests prove that failed persistence cannot leave a ghost local record, overwrite the last persisted payload, or display the wrong deletion state.
- `/login` and `/vault` now receive an application-owned nonce-based Content Security Policy. The policy restricts scripts to correctly nonced application code, disables script attributes, permits only the configured Supabase HTTP/WebSocket origins, retains the same-origin/blob crypto worker, blocks objects and framing, and restricts base/form/manifest sources.
- The protected routes also receive private/no-store caching, `nosniff`, `DENY` framing, no-referrer, restrictive permissions, cross-domain-policy denial, and HSTS plus insecure-request upgrading on HTTPS. Local HTTP Supabase development deliberately omits HSTS/upgrading while retaining CSP and the other controls.
- The response proxy forwards the same CSP nonce to Next.js rendering and returns the policy on both authenticated pages and redirects, including after Supabase refresh-cookie handling recreates the response.
- No encryption algorithm, KDF parameter, ciphertext envelope, Supabase schema, migration, RLS policy, Auth setting, hosted row, environment value, claimant behavior, publication state, commit, or deployment changed in this hardening.

**Verification:**

- Workspace tests passed: mobile 367 passed/2 protected live tests skipped, web 75 passed, shared validation 40 passed, and API 28 passed (510 passed in total, 2 skipped).
- Repository typecheck, zero-warning lint, Phase 1 DoD, repository security, GitHub Actions security, mobile-secret, Supabase database catalog, and RLS attack guards passed. Expo Doctor passed all 21 checks.
- The production web build passed with all public routes static and `/login` plus `/vault` dynamic.
- A local production Next.js runtime returned the nonce CSP and all expected hardening headers on `/login` and the unauthenticated `/vault` redirect. The login page loaded 17 correctly nonced scripts in a real Chromium session with zero browser-console errors or warnings.
- Mobile coverage passed with 367 tests: the hardened edit configuration has 100% line coverage, the vault session 88.13%, and the vault store 89.83%. Overall mobile coverage is 40.02% statements and 30.29% branches because many visual components remain outside unit coverage.
- The production dependency audit passed the high-severity threshold. Fourteen moderate transitive findings remain in the existing Expo `uuid` tooling chain and Next.js-bundled PostCSS; the offered force fixes remain breaking or invalid downgrades.
- This is local hardening evidence only. No authenticated local/hosted browser encrypted CRUD, native-device cross-client smoke matrix, hosted Supabase write, commit, preview, or production deployment was created.

**Next bounded action:** run the protected synthetic authenticated browser/native smoke matrix across representative field shapes and network-failure recovery, then review the complete local diff for commit. Do not publish the web vault or resume claimant work.

## Repository Baseline

- Repository: `C:\Projects\GitHub\Sandoq Kin`
- GitHub repository: `shahbaz242630/Document-Vault`
- Default/release branch: `main`
- `main` and `origin/main` verified at `c4f1f91` on 2026-07-19 after Phase 2 PR #33 merged.
- Documentation branch at the time of this handoff: `codex/export-compliance-handoff` at `3e0c99f`, one documentation commit above `main`.
- Clean MVP publication branch: `codex/mvp-api-frankfurt`, created directly from `main` so the unrelated export-compliance commit is excluded.
- Phase 2 was integrated through PR #33 as squash commit `c4f1f914427295d60be03303dd14a16b4bed6057` after every required check passed.
- Phase 3 implementation branch: `codex/mvp-landing-legal`, created directly from updated `main`; owner and legal review are pending.
- Expected unrelated local-only files: `.playwright-mcp/` and `welcome.png`; leave them untracked unless explicitly scoped.
- Monorepo workspaces: `apps/*`, `packages/*`, and `services/*`.
- Existing applications/services:
  - `apps/mobile`: Expo/React Native mobile application;
  - `services/api`: Hono API deployed on Vercel;
  - `packages/shared-types`: shared cross-client asset-type and envelope contracts;
  - `packages/shared-validation`: shared exhaustive vault-category registry, validation, payload, and summary contracts.
- The current `codex/mvp-landing-legal` branch contains the Phase 3 static landing/legal routes; protected web authentication; mobile/web crypto compatibility; and the global schema-driven owner-vault implementation for all 17 current asset types. `/claim` remains informational and inactive. These core-engine changes are not yet on `main` or a public production domain.

## Verified Live Infrastructure Baseline

Verified read-only on 2026-07-19:

- Supabase project status: `ACTIVE_HEALTHY`.
- Supabase primary database region: `eu-central-1` (Frankfurt).
- Existing Vercel project: `sanduqkin-api`.
- Vercel project root: `services/api`.
- Vercel Node.js version: `24.x`.
- Inspected production deployment route: `api/index` running in `iad1` (Washington, D.C.).
- `services/api/vercel.json` contains rewrites but no explicit function region.
- Hostinger domain registration was reported by the owner; DNS records and domain ownership were not independently changed or verified in this documentation slice.

### Immediate Performance Finding

The production API compute and Supabase database are currently on different continents. Database-dependent requests can travel from Vercel Washington to Supabase Frankfurt and back.

The first implementation slice must place the API function in Vercel `fra1` (Frankfurt), verify the deployed build reports `fra1`, and confirm health and existing processor routes still pass. Static website content will continue to be distributed globally by Vercel's CDN; this placement affects dynamic server-side compute, not the public CDN or the database location.

Do not assume the change succeeded merely because `vercel.json` validates. Inspect the resulting production or protected preview deployment.

## Approved Target Architecture

### Deployment And Domain Map

| Surface | Repository root | Hostname | Responsibility |
| --- | --- | --- | --- |
| Mobile application | `apps/mobile` | Native app | Owner vault, owner-side encryption, owner controls |
| Public website | `apps/web` | `sanduqkin.com` | Landing, product information, security explanation, legal and support pages |
| Canonical redirect | `apps/web` | `www.sanduqkin.com` | Permanent redirect to `sanduqkin.com` |
| Claimant portal | `apps/web` | `app.sanduqkin.com` | Isolated authentication, claim application, status, and eventual local decryption |
| Shared API | `services/api` | `api.sanduqkin.com` | Canonical mobile/web contracts, authorization, claim state machine, rate limits, audit |
| Identity/data | Supabase | Managed service | Authentication, RLS-protected metadata, ciphertext, sealed key packages, audit state |
| DNS/registration | Hostinger | Domain control | DNS records pointing approved hosts to Vercel |

### Web Technology Decision

- Create `apps/web` using Next.js App Router and TypeScript.
- Deploy it as a separate Vercel project rooted at `apps/web`.
- Keep the API as a separate Vercel project rooted at `services/api`.
- Statically generate public product and legal content wherever possible.
- Use dynamic server execution only for authenticated claimant operations.
- Keep the Hono API as the canonical business API used by both mobile and web.
- Use shared packages for versioned API schemas, validation, identifiers, and safe protocol types as the flow is designed.
- Do not move privileged claim logic into page components or create a second independent claim implementation in Next.js.

### Authenticated Web Boundary

Prefer a thin, same-origin session/BFF layer under `app.sanduqkin.com` so browser code does not need to persist bearer tokens in `localStorage`. The portal may forward authenticated, ciphertext-only requests to the canonical Hono API.

Before standardizing the session implementation, build a narrow proof of concept covering Supabase PKCE sign-in, refresh, sign-out, host-only secure cookies, CSRF/origin enforcement, and server-side user verification. Supabase's SSR helpers and their current stability must be rechecked at implementation time.

The BFF is not permitted to:

- receive or log plaintext vault records;
- receive a claimant private key or its recovery secret;
- hold a master encryption key;
- use browser-exposed service-role credentials; or
- create a second source of truth for claim status.

## Architecture Decision Record

### Confirmed Decisions

- Keep one GitHub monorepo and use separate Vercel projects per deployable root.
- Keep Hostinger as registrar/DNS rather than migrating registration merely for hosting.
- Use separate public and claimant hostnames as a real browser-origin boundary.
- Keep one canonical Hono API for mobile and web.
- Keep the existing Supabase project and identity system for the MVP.
- Co-locate dynamic Vercel compute with the Frankfurt Supabase primary.
- Keep marketing and legal pages static and independent from API health.
- Preserve zero knowledge: infrastructure stores ciphertext and controlled metadata, never normal vault plaintext.
- Use client-generated recipient key material and client-side release decryption.
- Keep `/claim` inactive until the threat model, protocol, database policy, and authorization gates pass.
- Refer to an applicant as a **claimant** and a user-selected person as a **trusted recipient** unless legal counsel approves a jurisdiction-specific “next of kin” assertion.

### Rejected Or Unsafe Assumptions

- A valid account does not prove a family relationship.
- Possession of a handover code does not prove identity or legal entitlement.
- MFA proves control of authentication factors, not entitlement to released data.
- A backend re-encryption step involving plaintext MEKs is not compatible with the zero-knowledge promise.
- A Vercel multi-region function does not make a single-primary Supabase database multi-region.
- Preview deployments must not use production claimant data.
- A URL query parameter must not contain the full emergency secret.
- Existing owner-only RLS policies do not automatically support claimants.
- An owner-approval-only flow does not solve the case where the owner is deceased or incapacitated.

## Current Emergency-Access Code Reality

The repository already contains an emergency-access foundation, but it is not a public claim system.

### Implemented Today

- Mobile generates a 20-character code in five groups of four.
- The alphabet contains 32 unambiguous characters, providing approximately 100 bits before any generation-bias analysis.
- The raw code is shown once and is not stored by the repository.
- The code derives a wrapping key with Argon2id.
- Current Argon2id parameters are 256 MiB memory, three operations, and a 32-byte output.
- The MEK is wrapped with XChaCha20-Poly1305 and associated data.
- Supabase stores the sealed package, KDF metadata, nonce, ciphertext, status, and safe audit events.
- Tests assert that the raw code and plaintext MEK are not serialized.

### Not Implemented Today

- A public, non-secret locator for finding the correct grant.
- A domain-separated possession proof that avoids sending the raw secret.
- Claimant registration, identity verification, or MFA enforcement.
- Relationship/evidence review.
- A claimant-readable RLS/API model.
- A server-enforced release state machine.
- Notification, cooldown, challenge, or release authority.
- Browser-side KDF performance verification.
- A read-only claimant vault viewer.

### Required V2 Code Design

Before a web code-claim route becomes active, define a versioned code with:

- a public locator safe to submit to the API;
- a separate high-entropy client-only secret;
- an optional domain-separated possession proof derived locally;
- strict expiry, attempt limits, throttling, abuse monitoring, and revocation;
- no raw secret in query strings, analytics, logs, audit metadata, support tools, or database rows; and
- compatibility behavior for existing version-one sealed codes.

Existing grants have no public locator. Do not solve this by scanning all grants or sending the full secret to the server. The likely migration is owner-confirmed regeneration into the V2 format after the protocol is approved. Do not revoke an existing active code automatically.

The 256 MiB Argon2id setting may be expensive in mobile browsers. Benchmark the exact WebAssembly/browser implementation in a Web Worker across representative iPhone, Android, desktop, and low-memory devices. Do not silently lower the KDF cost; any change requires a documented cryptographic review and compatibility plan.

## Intended Claimant Routes

### Route A: Registered Trusted Recipient

Intended sequence, subject to threat-model approval:

1. The owner nominates a trusted recipient in the mobile app.
2. Sanduqkin sends a value-free invitation through the approved notification provider.
3. The recipient creates or verifies a Sanduqkin identity and enrolls MFA.
4. The recipient client generates a public/private key pair locally.
5. Only the public key and an approved encrypted private-key recovery package leave the client.
6. The owner is prompted to unlock the mobile vault and locally creates a recipient-specific sealed MEK grant using the recipient public key.
7. The recipient may later submit a claim, but claim submission does not release data.
8. Identity, evidence, challenge/cooldown, and release authorization occur as separate states.
9. After authorized release, infrastructure returns ciphertext and the recipient-specific sealed package.
10. The recipient client decrypts locally into a read-only experience.

The current `pre_authorized_kin` helper accepts a symmetric 32-byte wrapping key. It is not yet a complete public-key exchange or account-bound protocol. Do not expose it as if registered-recipient cryptography were finished.

### Route B: Offline Handover Code

Intended sequence, subject to threat-model approval:

1. The owner creates and confirms a versioned sealed code in the mobile app.
2. The owner gives it to a trusted person offline or stores it with important papers.
3. The claimant opens the website or app and submits only the public locator initially.
4. The claimant authenticates, enrolls MFA, and completes client-side code-possession proof.
5. The claimant applies for release and supplies only evidence approved by the future legal/security design.
6. The same controlled review, challenge/cooldown, and release state machine applies.
7. Only after authorized release does the client receive the sealed package and encrypted records.
8. The client uses the secret locally to unwrap the MEK and decrypt a read-only view.

Do not treat knowledge of the code as automatic release authorization.

## Unresolved Product And Legal Blocker: Release Authority

Live release cannot be implemented until the owner decides, with security and legal review, who or what authorizes release when the vault owner cannot respond.

The design must explicitly answer:

- Is release approved by the living owner, a Sanduqkin operations reviewer, a documented legal process, trusted witnesses, an inactivity/cooldown rule, or a defined combination?
- What evidence is accepted, for which jurisdictions, and who is qualified to evaluate it?
- How is the owner notified and allowed to challenge or cancel a fraudulent request?
- What waiting period applies, and what events restart or stop it?
- What happens if an owner loses access but is alive?
- What appeal, dispute, and audit process exists?
- Which entity is the data controller/operator and what governing law applies?

Until this is approved, the website may explain the future process and accept no real claim submission. Do not imply that Sanduqkin legally certifies a next-of-kin relationship.

## Database And API Gaps

Existing Supabase tables are `emergency_contacts`, `emergency_key_grants`, and `emergency_release_requests`. Their current authenticated RLS policies are owner-based through `auth.uid() = user_id`. Anonymous access has been revoked.

Therefore, the current schema cannot safely support a claimant. Before changing it:

- write the protocol and threat model first;
- define separate owner, claimant, reviewer/service, and processor capabilities;
- prefer explicit API-mediated transitions plus defense-in-depth RLS;
- require `aal2` for sensitive operations;
- add immutable or append-only state-transition audit records;
- use database constraints to prevent illegal state changes;
- use idempotency keys for claim submission and release operations;
- keep PII and verification metadata minimal, classified, and retention-bound;
- use append-only migrations rather than editing applied migrations; and
- extend hosted RLS attack tests for cross-user, anonymous, claimant, stale-token, and replay scenarios.

Candidate concepts may include invitations, claimant identities, recipient public keys, code locators, claims, claim events, release authorizations, and sealed release packages. Final table names and schemas are intentionally deferred to the design slice.

## Security Requirements

### Identity And Authorization

- Distinguish authentication, code possession, identity proofing, relationship/entitlement review, and release authorization.
- Require Supabase MFA assurance level `aal2` for key registration/replacement, claim submission, release approval, and sealed-package retrieval.
- Re-verify the user server-side for every sensitive request.
- Use least-privilege API credentials and explicit authorization at every transition.
- Apply CAPTCHA and layered rate limits to public/authentication/claim-entry endpoints.
- Prevent account and locator enumeration with uniform responses and bounded timing.
- Never rely on client-supplied claim status, owner ID, grant ID, reviewer role, or assurance level.

### Browser And Network

- Keep authentication cookies host-only; never set `Domain=.sanduqkin.com`.
- Use `Secure`, appropriate `SameSite`, short session bounds, rotation, revocation, and CSRF/origin checks.
- Prefer no persistent bearer token in `localStorage` or `sessionStorage`.
- Use strict CSP with nonces/hashes where dynamic scripts require them.
- Set HSTS, `frame-ancestors 'none'`, `nosniff`, a restrictive referrer policy, and a minimal permissions policy.
- Allow only exact production/preview origins where CORS is necessary.
- Do not run advertising or unnecessary third-party analytics on `app.sanduqkin.com`.
- Mark authenticated and claimant responses private/no-store; do not cache personalized data at the CDN.
- Protect preview deployments and use fake or isolated development data.

### Zero-Knowledge And Cryptography

- Never send plaintext vault content, a raw MEK, a claimant private key, recovery phrase, seed phrase, password, or full emergency secret to Vercel, Supabase, GitHub, analytics, logs, support systems, or email.
- Keep the Supabase service-role key only in the canonical API/processor environment, never in browser code or `NEXT_PUBLIC_*` variables.
- Recipient key pairs are generated client-side.
- Owner-side grant finalization occurs only after the owner unlocks the mobile vault.
- Browser decryption occurs locally and should keep plaintext in memory for the shortest practical time.
- Do not add export, download, print, clipboard, or persistent offline storage to the claimant viewer without a separate threat review.
- Use versioned cryptographic envelopes and domain-separated associated data/proofs.
- Obtain focused cryptographic review before selecting the public-key sealed-box construction and recovery design.

### Logging And Privacy

- Logs and audit events must remain value-free: identifiers, safe state, timestamps, reason codes, and correlation IDs only.
- Never log request bodies on claim or release endpoints.
- Define retention and deletion for claimant PII, rejected claims, evidence, operational logs, and audit records before collecting them.
- Do not add claimant document uploads in the initial MVP. If later required, design an isolated quarantine/scan/review/storage pipeline with allowlisted types, size limits, randomized names, malware scanning, access control, encryption, and deletion.

## Resilience, Scaling, Cost, Optimization, And Performance

### Resilience

- Static marketing/legal content must remain available when Supabase or the API is degraded.
- Supabase is currently a single primary region; do not claim multi-region database failover.
- Keep durable workflow state in Postgres, never in Vercel process memory.
- Use transactional state changes, retries with bounds, idempotency, and an outbox/processor pattern for notifications.
- Maintain an external uptime check for the public site, portal health, API health, and critical processors.
- Supabase Pro daily backups are adequate for the static-site phase; run a restore drill before live claims.
- Before live claims, select PITR or document an equivalent acceptable recovery strategy and recovery-point objective.
- Keep schema, configuration, functions, and operational runbooks reproducible because a database restore alone does not recreate every service setting or stored object.

### Scaling

- The proposed Next.js/Vercel plus Hono/Vercel plus Supabase design is sufficient for MVP traffic.
- Do not buy read replicas, multi-region compute, or Enterprise plans without measured need.
- Read replicas do not make Auth, Storage, or Realtime multi-region and should not be treated as a claim-flow availability solution.
- Add indexes from observed query plans and load tests, not speculation.
- Apply pagination and response-size limits from the first claimant API version.

### Cost Baseline

Pricing verified on 2026-07-19 and must be rechecked before purchasing:

- Vercel Pro starts around USD 20 per developer/month plus usage.
- Supabase Pro starts around USD 25/month and includes the first project's micro compute credit.
- A separate always-on Supabase development project may add compute cost.
- Supabase PITR was listed as an additional paid capability, around USD 100/month for seven days.
- Domain registration, transactional email/SMS, legal review, taxes, storage, and usage overages are separate.
- A second Vercel project does not inherently require a second developer seat.

Configure billing alerts and a deliberate spend limit. Do not rely on a free/personal hosting tier for commercial production.

### Optimization And Performance

- Statically render landing, features, security, privacy, terms, deletion, and support pages.
- Keep authenticated portal pages dynamic and explicitly non-cacheable.
- Place API and authenticated web compute in `fra1` near Supabase `eu-central-1`.
- Lazy-load browser cryptography only on routes that need it.
- Run Argon2 and heavy cryptography in a Web Worker to avoid freezing the UI.
- Benchmark GCC user latency and browser KDF performance before activation.
- Keep API calls coarse enough to avoid repeated database round trips.
- Use Vercel monorepo project roots and affected-build skipping; use GitHub path filters so web-only changes do not trigger expensive native CI unnecessarily.

## Public Website And Legal Content

Initial public routes:

- `/` - landing page and clear product positioning;
- `/features` - current features only, with future functionality labeled accurately;
- `/how-it-works` - zero-knowledge owner flow and controlled future claim concept;
- `/security` - plain-language security model and responsible disclosure contact;
- `/privacy` - public privacy policy;
- `/terms` - terms of use;
- `/account-deletion` - public deletion instructions consistent with the in-app process;
- `/support` - support and contact path; and
- `/claim` - inactive informational entry until activation gates pass.

Legal pages should be accessible HTML, stable, versioned in Git, dated, and available without authentication or geographic blocking. Before publication, obtain the legal entity name, controller/contact address, privacy/support contacts, governing law, processor list, data categories, purposes, retention periods, deletion behavior, cross-border transfer position, and counsel approval appropriate to the initial GCC scope.

Do not add non-essential cookies or trackers by default. If analytics is later proposed, perform a separate privacy/consent review and keep analytics off the claimant origin unless specifically approved.

## Mobile And Web Linking

The mobile app currently has the custom scheme `sanduqkin` but no verified iOS Associated Domains configuration or Android App Links intent filters.

The future linking slice must:

- serve `/.well-known/apple-app-site-association` without redirects or secrets;
- serve `/.well-known/assetlinks.json` with the verified Android package and signing-certificate fingerprint;
- add the exact iOS associated domain entitlement;
- add narrow Android HTTPS intent filters;
- use an allowlisted path grammar and never place an emergency secret in a universal/app link query string;
- provide safe browser fallback behavior; and
- test on physical iOS and Android builds because native association changes are not proven by a browser-only test.

## GitHub And Delivery Controls

- Preserve required reviews and checks on `main`.
- Add web typecheck, lint, unit/component tests, build, dependency audit, secret scanning, and focused browser smoke coverage.
- Extend `CODEOWNERS` for `apps/web`, shared claim contracts, claim migrations, legal pages, and domain-association files.
- Keep GitHub Actions pinned to immutable commit SHAs and update deprecated action runtimes in their own tooling slice.
- Enable Dependabot, secret scanning, push protection, and dependency review where the repository plan supports them.
- Use least-privilege workflow permissions.
- Never expose production environment secrets to pull-request workflows or untrusted forks.
- Protect Vercel previews and connect them only to fake or isolated non-production data.
- Use concurrency cancellation and path filters to control CI cost.

## Implementation Phases

### MVP Phase 1: API Region Alignment

**Status:** Implemented, production-verified, and merged through PR #32 on 2026-07-19. See `Phase Completion Evidence` below.

**Objective:** remove the verified Washington-to-Frankfurt dynamic-data path before adding web traffic.

**Build:**

- Add the supported `fra1` region setting to the existing `services/api` Vercel configuration.
- Add a narrow regression check so removal or accidental reversion is detected.
- Do not alter database regions, endpoints, secrets, API behavior, or processors.

**Test:**

- Validate configuration and run API typecheck/tests.
- Run repository security/configuration guards affected by the edit.
- Deploy through the approved Vercel path.
- Inspect the deployed function and verify `api/index` reports `fra1`.
- Verify health, account-deletion, audit-retention, and RevenueCat route behavior without emitting sensitive values.
- Compare a small set of value-free latency measurements before and after.

**Exit gate:** production or approved target deployment is healthy in `fra1`, existing API checks pass, and rollback is documented. Stop for review.

### MVP Phase 2: Web Workspace Scaffold

**Status:** Implemented, protected-preview-verified, and integrated through PR #33 on 2026-07-19. See `Phase Completion Evidence` below.

**Objective:** create a production-quality but content-minimal `apps/web` foundation.

**Build:**

- Scaffold Next.js App Router with TypeScript under `apps/web`.
- Integrate root workspaces, lint, typecheck, tests, and deterministic build.
- Add a minimal accessible shell, metadata, error/not-found pages, and static health signal.
- Create a separate Vercel project rooted at `apps/web` using non-production configuration.
- Add no Supabase secret, claim endpoint, authentication, analytics, or browser cryptography.

**Test:**

- Web typecheck, lint, unit tests, production build, dependency audit, and local browser smoke.
- Confirm existing mobile/API tests remain green.
- Inspect the client bundle and deployment environment for secrets.
- Verify preview protection and that the preview cannot access production claimant data.

**Exit gate:** an isolated preview renders correctly and all new/existing required checks pass. Stop for review.

### MVP Phase 3: Landing And Legal Information

**Status:** Implemented and protected-preview-verified on 2026-07-19. On the owner's direction, unresolved legal/publication work is parked while protected core-flow engineering continues. Public publication remains blocked. See `Owner Sequencing Decision: Core Flow Before Publication` and `Phase Completion Evidence` below.

**Objective:** deliver the public informational MVP without enabling claims.

**Build:**

- Implement the approved public routes and responsive navigation/footer.
- Use accurate present-tense feature copy and label future claim features clearly.
- Add draft/versioned privacy, terms, deletion, support, security, and accessibility content with unresolved legal fields visibly tracked outside published copy.
- Keep `/claim` informational and inactive.

**Test:**

- Accessibility, keyboard, responsive, SEO metadata, broken-link, and browser smoke tests.
- Validate legal pages are public HTML and contain correct effective/version information.
- Confirm no form suggests that a live claim can be submitted.
- Confirm no non-essential cookie or tracker is introduced.

**Exit gate:** owner approves content/design, legal placeholders are resolved or publication remains blocked, and the static build passes. Stop for review.

### MVP Phase 4: Production Domains And Web Hardening

**Objective:** publish the static MVP safely on the registered domain.

**Build:**

- Attach `sanduqkin.com` and `www.sanduqkin.com` to the web project using exact Vercel-provided DNS records in Hostinger.
- Redirect `www` canonically to the apex domain.
- Reserve `app.sanduqkin.com` for the claimant portal and `api.sanduqkin.com` for the Hono API; do not activate claim routes.
- Add strict security headers, cache policy separation, robots/sitemap, and minimal operational monitoring.
- Set billing alerts/spend controls.

**Test:**

- DNS, TLS, redirect, caching, CSP/header, uptime, accessibility, and browser checks.
- Confirm public static pages remain usable during a controlled API-unavailable test.
- Confirm claimant/private routes are not indexed and `/claim` remains inactive.

**Exit gate:** the public/legal website is securely available on the production domain with monitoring and rollback evidence. This is the first public website MVP milestone. Stop for review.

### MVP Phase 5: Universal Links And App Links

**Objective:** connect approved website paths to the installed mobile app without exposing secrets.

**Build:**

- Add and serve the Apple and Android association files.
- Add exact native entitlements/intent filters for approved HTTPS paths.
- Define browser fallback and route allowlists.
- Keep secret material out of links.

**Test:**

- Validate association files, content types, TLS, and redirects.
- Test installed/not-installed behavior on physical iOS and Android builds.
- Test malformed, hostile, and unapproved routes.
- Run native build/security checks required by the app configuration change.

**Exit gate:** approved links open only intended routes on both platforms, browser fallback is safe, and no claim secret enters network logs. Stop for review.

### MVP Phase 6: Claim Protocol, Threat Model, And Contracts

**Objective:** approve the system before exposing a real claimant endpoint.

**Build:**

- Produce data-flow and threat models for both claimant routes.
- Resolve release authority, evidence, cooldown/challenge, jurisdiction, retention, and operator responsibilities.
- Specify versioned cryptographic envelopes and the V2 locator/secret format.
- Define API contracts, state transitions, roles, RLS rules, audit events, abuse controls, error semantics, and compatibility.
- Prototype portal session/BFF behavior and browser cryptography performance without production data.

**Test:**

- Security design review against current OWASP ASVS Level 2, transaction authorization guidance, NIST identity separation, and applicable privacy requirements.
- Protocol test vectors, state-machine property tests, replay/guessing analysis, and browser KDF benchmarks.
- RLS policy tests designed before migrations are approved.

**Exit gate:** written owner/security/legal approval of release authority and protocol; tests demonstrate feasibility; no unresolved critical threat. Stop for review. No live claim yet.

### MVP Phase 7: Registered Trusted-Recipient Foundation

**Objective:** implement invitation, identity, MFA, public-key registration, and owner-side grant finalization without release.

**Build:**

- Add invitation and recipient identity/account linking.
- Enforce verified authentication and `aal2` for key operations.
- Generate claimant key pairs client-side and store only approved public/encrypted material.
- Add owner-mobile confirmation and local recipient-specific MEK wrapping.
- Add revocation/replacement and value-free audit behavior.

**Test:**

- Cross-account/RLS attacks, invitation enumeration, replay, expired invitation, key substitution, stale session, downgrade, revocation, and lost-device cases.
- Mobile/web/API integration using non-production identities and ciphertext-only fixtures.
- Confirm no private key, raw MEK, or plaintext enters infrastructure or logs.

**Exit gate:** a recipient can be safely registered and granted sealed material, but cannot submit or receive a live release. Stop for review.

### MVP Phase 8: V2 Offline-Code Claim Initiation

**Objective:** permit safe claim initiation using the new split locator/secret design without data release.

**Build:**

- Implement owner-side V2 code creation/regeneration and explicit legacy handling.
- Implement public locator lookup, client-side possession proof, authentication/MFA, throttling, CAPTCHA, expiry, and revocation.
- Create a submitted claim record with minimal metadata.
- Keep release and decryption disabled.

**Test:**

- Brute force, enumeration, replay, timing, malformed code, revoked code, expired proof, duplicate submission, rate-limit bypass, logging, URL/referrer, and analytics leakage tests.
- Benchmark client KDF and verify Web Worker isolation.
- Confirm existing V1 grants are neither exposed nor silently revoked.

**Exit gate:** an authorized test claimant can create only a controlled submitted claim, with no access to a sealed package or vault data. Stop for review.

### MVP Phase 9: Review, Challenge, And Release State Machine

**Objective:** implement the separately approved authorization process.

**Build:**

- Implement legal state transitions, owner/operator notifications, challenge/cancel, cooldown, approval/rejection, idempotency, immutable audit, and bounded processors.
- Enforce role, `aal2`, time, evidence, and transition constraints server-side and in the database.
- Produce only recipient-specific sealed release packages.

**Test:**

- Illegal transition, role confusion, replay, concurrent approval/rejection, processor retry, notification failure, owner challenge, expired authorization, insider misuse, audit tampering, backup/restore, and incident rollback tests.
- Conduct a restore drill and confirm the recovery objective is acceptable.

**Exit gate:** the state machine cannot be bypassed in automated and manual security testing; release authority and operations runbooks are approved. Stop for review.

### MVP Phase 10: Local Read-Only Claimant Viewer And Pilot

**Objective:** deliver approved ciphertext for local browser/app decryption and conduct a controlled pilot.

**Build:**

- Retrieve only an authorized claimant-specific sealed package and encrypted records.
- Decrypt locally into a read-only, non-persistent viewer.
- Add memory/session cleanup, re-authentication, lock/timeout, safe error handling, and support/incident paths.
- Keep export, clipboard, offline persistence, and sharing disabled unless separately approved.

**Test:**

- End-to-end registered-recipient and code-route tests on representative browsers/devices.
- XSS/CSP, session theft, cache, back-button, browser history, crash/reporting, screenshot-risk messaging, memory/performance, accessibility, and logout cleanup checks.
- Independent security review or focused penetration test before real claimant data.
- Small invitation-only pilot with monitoring, support ownership, kill switch, and rollback.

**Exit gate:** owner accepts pilot evidence and residual risks before any broader claimant launch. Stop and update all active handoffs.

## Phase Completion Evidence

### MVP Phase 1: API Region Alignment - Implemented And Production-Verified 2026-07-19

**Implemented:**

- Added the project-level `"regions": ["fra1"]` setting to `services/api/vercel.json`.
- Added `services/api/src/deployment-config.test.ts`, which fails unless the API has exactly one configured execution region and it is `fra1`.
- Did not change Supabase, endpoints, credentials, processors, database schemas, or API behavior.

**Provider verification:**

- Rechecked Vercel's official function-region documentation before implementation; the page was last updated 2026-07-01 and confirms the project-level `regions` array.
- The installed global Vercel CLI `46.0.2` could inspect existing deployments but was rejected by the current deployment endpoint as outdated.
- The owner completed Vercel's device-login flow for the current CLI.
- Preview deployment `dpl_5F5GAtQd7r6vwQUSjdmAaqoMrxv2` reached `READY`; inspection reported `api/index` in `fra1`, and its protected `/health` route returned `200` with the expected value-free body.
- Production deployment `dpl_7dVi7pRcxw6EbcxgbLviSsJrS4Jj` reached `READY`, received the `https://sanduqkin-api.vercel.app` alias, and inspection reported `api/index` in `fra1`.

**Automated verification:**

- API focused region test: 1 passed.
- API full suite: 11 files and 28 tests passed.
- Repository typecheck passed across mobile, shared packages, and API.
- Repository lint passed with zero warnings.
- Workspace tests passed: mobile 343 passed/2 protected live tests skipped, shared validation 10 passed, and API 28 passed.
- Phase 1 DoD, security, GitHub Actions security, and mobile-secret guards passed.
- Production dependency audit remained at the accepted high-severity threshold: no high or critical finding; 12 known moderate `uuid` findings remain through Expo tooling, and the offered force fix is breaking.
- The local Supabase database security command could not connect because Docker Desktop's local Supabase container was not running. No schema or database policy changed in this phase, and the migration/schema assertions included in the passing mobile suite were unaffected. A hosted/local database security run is not required to establish the function-region change, but the standard database guard remains required for any later schema slice.

**Production behavior:**

- `/health` returned `200` after cutover.
- Unauthenticated account-deletion request and both internal processor routes retained their pre-change `401` behavior.
- The unauthenticated RevenueCat route retained its pre-change `503` behavior under its current production configuration; this slice did not change or claim readiness for Phase 3 payments.
- Five value-free health samples before the change ranged from approximately 275 ms to 1,503 ms with a 514 ms median; five after the change ranged from approximately 289 ms to 689 ms with a 531 ms median. The warmed health route was effectively flat, as expected because it does not call Supabase. No database-latency improvement is claimed without a protected, controlled benchmark. The verified architectural improvement is removal of the Washington-to-Frankfurt function/database placement mismatch.

**Rollback:**

- Immediate operational rollback target: prior production deployment `dpl_9DacBVy4HVf4Zcetw5Ux4bgM9MkN` (`sanduqkin-4ck7e91zr-shahbaz-ali-maliks-projects.vercel.app`).
- Current CLI command: `npx --yes vercel@56.3.2 rollback dpl_9DacBVy4HVf4Zcetw5Ux4bgM9MkN --yes`.
- A durable rollback must also revert the `fra1` configuration and its regression expectation before the next production deployment. Do not perform either rollback unless monitoring or functional evidence requires it.

**Residual tooling note:** update the globally installed Vercel CLI in a separate tooling slice; this phase used `npx --yes vercel@56.3.2` to avoid an unrelated global installation change.

**Repository integration:** PR #32 merged the Phase 1 files to `main` as squash commit `affaef16e91e17d47df1dfc5a053598f61f66573`. The subsequent main-driven deployment `dpl_HTf8o8AU2uibJVWtCuVX5WMqwanQ` reached `READY` in `fra1`, so Git-driven deployments no longer risk silently reverting the API to `iad1`.

**Phase 1 gate satisfied:** MVP Phase 2 was allowed to begin after the merge and main-driven deployment verification.

### MVP Phase 2: Web Workspace Scaffold - Implemented And Preview-Verified 2026-07-19

**Implemented:**

- Added `apps/web` as a pinned Next.js `16.2.10`, React `19.2.3`, App Router, and strict TypeScript workspace.
- Added a content-minimal responsive shell, semantic landmarks, keyboard skip link, metadata, `noindex, nofollow`, error recovery page, true not-found page, static favicon, and value-free static `/health.json`.
- Added web lint, typecheck, Vitest, build, root workspace scripts, Next-specific lint rules scoped so they coexist with Expo, and seven focused regression tests.
- Disabled the `X-Powered-By` framework header.
- Added no form, claim endpoint, authentication, Supabase client or credential, API call, analytics, browser storage, browser cryptography, production domain, or claimant data path.

**Local and repository verification:**

- Web focused checks passed: seven tests, typecheck, lint with zero warnings, and a production build with `/` and `/_not-found` prerendered as static content.
- Playwright CLI smoke-tested the production build at desktop and 390 by 844 mobile viewports; the accessible shell rendered correctly, `/not-a-real-page` returned a custom `404`, and `/health.json` returned only `{ "ok": true, "service": "sanduqkin-web", "mode": "static" }`.
- Repository typecheck and lint passed.
- Workspace tests passed: mobile 343 passed/2 protected live tests skipped, web 7 passed, shared validation 10 passed, and API 28 passed; 388 tests passed in total.
- Phase 1 DoD, repository security, GitHub Actions security, and mobile-secret guards passed.
- Source and built-client scans found no service-role material, private key marker, payment secret marker, Supabase public configuration, or application `process.env` use. Source inspection also found no network, authentication, browser-storage, or form primitives.
- The production dependency audit passed at the configured high-severity threshold with no high or critical finding. Fourteen moderate findings remain: the accepted Expo `uuid` chain plus Next's bundled PostCSS advisory. The offered force fixes are breaking or invalid downgrades; recheck supported upstream releases before Phase 3 rather than forcing them.
- The local machine remains on Node `24.2.0`, one patch below the repository's deliberate `>=24.3.0` range. The same build passed on Vercel Node `24.x`; update the local runtime separately rather than weakening the repository engine requirement.

**Vercel preview verification:**

- Created separate project `sanduqkin-web` (`prj_79jnCawgYkg4Fey9wFuiwYw0DpOk`) under `shahbaz-ali-maliks-projects`.
- Connected it to GitHub repository `shahbaz242630/Document-Vault`, set the final root directory to `apps/web`, selected the Next.js preset, and retained Node `24.x`.
- No Vercel environment variables exist for the project. No custom or production domain was attached.
- SSO deployment protection is `all_except_custom_domains`, Git-fork protection is enabled, and unauthenticated requests to both `/` and `/health.json` returned a `302` to Vercel SSO with `Cache-Control: no-store`, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex`.
- Preview deployment `dpl_BBG8apRS6yyruJcn7fgRvJ29QJ85` is `READY` with target `preview` at `https://sanduqkin-8cfsc1ptp-shahbaz-ali-maliks-projects.vercel.app`.
- Authorized, value-free checks returned `200` for `/`, `200` for the static health JSON, and `404` for an unknown path. The page response reported `X-Nextjs-Prerender: 1` and Vercel prerender caching.
- The CLI created temporary automation bypasses during protected checks. The two disposable bypasses were revoked and the required platform automation credential was rotated after verification. The generated local `.env.local` OIDC credential file was deleted without reading or committing its value.
- For this local-only preview upload, the remote root was temporarily cleared because the CLI otherwise applied `apps/web` twice; it was restored immediately after deployment. Future durable deployments should be Git-driven from the connected monorepo with the verified final root `apps/web`.

**Residual boundary:** Vercel inspection lists the Next output handler in `iad1`, but this scaffold has no environment variables, API/database calls, user input, or data access and its pages are prerendered. Dynamic claimant compute remains a later design slice and must be placed with the Frankfurt data plane when introduced.

**Repository integration:** PR #33 merged the Phase 2 scaffold to `main` as squash commit `c4f1f914427295d60be03303dd14a16b4bed6057`. All required application-security, CodeQL, OWASP ZAP, GitGuardian, Vercel API/web, Android native/emulator, iOS simulator, and local/hosted Supabase checks passed. Main-driven deployment `dpl_CGHTEEZwgBRgLurJ6VGYfDdnUVeU` reached `READY` without a custom domain.

### MVP Phase 3: Landing And Legal Information - Implemented And Preview-Verified 2026-07-19

**Implemented:**

- Added static routes for `/`, `/features`, `/how-it-works`, `/security`, `/privacy`, `/terms`, `/account-deletion`, `/support`, `/accessibility`, and an explicitly inactive `/claim` information page.
- Added responsive shared navigation/footer, semantic landmarks, a working keyboard skip link, per-page metadata, sitemap, protected-preview robots policy, and a generated 1200 by 630 social card.
- Legal pages display `Preview draft 0.1`, review date `19 July 2026`, `Not yet effective`, and a prominent draft-review status. Unresolved entity, address, contact, jurisdiction, processor, transfer, retention, deletion-channel, counsel, accessibility, and claim-protocol decisions are tracked outside published copy in `apps/web/LEGAL_CONTENT_REVIEW.md`.
- Added no form, claimant submission, authentication, Supabase client or credential, API request, analytics, cookie banner, browser persistence, browser cryptography, production domain, or claimant data path.

**Verification:**

- Web Vitest passed 15 focused tests across three files. The tests validate every route, internal link integrity, legal version/status text, sitemap/robots output, an inactive claim page with no controls, and absence of browser storage, network, analytics, and Supabase integration.
- Web typecheck, root lint with zero warnings, repository security check, and the production build passed. All ten content routes plus metadata routes were statically prerendered.
- A real-browser matrix covered all ten routes at 390-pixel mobile and 1280-pixel desktop widths: every route returned `200`, exposed one unique title and one H1, contained one `main#main-content`, had no form control, retained `noindex, nofollow`, and had no horizontal overflow.
- Mobile navigation, keyboard skip-link focus, desktop/mobile visual layout, zero browser-console errors/warnings, same-origin-only requests, and empty cookie/local/session storage were verified.
- Injected axe-core `4.12.1` scans found zero definite accessibility violations after contrast fixes. The remaining incomplete items were limited to decorative pseudo-elements; this is strong preview evidence, not a claim of full WCAG conformance.
- The production dependency audit passed the high-severity threshold. Fourteen moderate findings remain in the existing Expo `uuid` tooling chain and Next.js's bundled PostCSS; offered force fixes are breaking/invalid downgrades and were not applied.

**Protected Vercel preview:**

- Deployment `dpl_56CPAxso438Az7z6pmVwisotCiH5` is `READY`, target `preview`, at `https://sanduqkin-noush0isa-shahbaz-ali-maliks-projects.vercel.app`.
- Vercel built all routes successfully on Node `24.x` in `iad1`; the content is statically prerendered and has no data-plane dependency.
- The project root remains `apps/web`, no environment variables or custom domain exist, and the repository's root local Vercel link was restored to `sanduqkin-api` after the isolated upload.
- An unauthenticated request returned `302` to Vercel SSO with `Cache-Control: no-store`, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex`.

**Phase 3 exit gate:** implementation and technical preview verification are complete. Publication remains blocked until the owner approves content/design and the legal checklist is resolved or counsel explicitly accepts the remaining publication status. The owner subsequently authorized protected core-flow engineering to proceed out of publication order; this does not authorize production domains, effective legal content, or live claims.

## Standard Verification Baseline

Retain the repository checks and add the focused web build before each web handoff:

```powershell
npm run typecheck
npm run lint
npm test --workspaces --if-present
npm run build --workspace @vault/web
npm run check:phase1
npm run check:security
npm run check:github-actions-security
npm run check:mobile-secrets
npm run check:supabase-db-security
npm audit --omit=dev --workspaces --audit-level=high
```

Each new phase must add its exact web/API/database/browser/native commands here or to a phase-specific operations document once they exist. Do not claim a browser flow is verified from unit tests alone, and do not claim a native association flow is verified from a desktop browser.

## Future Session Startup Checklist

1. Read `HANDOFF.md`, `SECURITY_HANDOFF.md`, and `MVP_HANDOFF.md` completely.
2. Run `git status --short --branch` and `git log --oneline --decorate -5`.
3. Preserve `.playwright-mcp/`, `welcome.png`, and any unrelated user changes.
4. Confirm whether the current branch contains commits not yet on `main`.
5. Locate the first MVP phase without a recorded completed exit gate.
6. Recheck time-sensitive provider/framework/security guidance for that phase.
7. Verify live configuration read-only before changing it; never assume dashboard state from repository files alone.
8. Confirm the current environment is still classified as protected development. If anyone proposes production readiness or external authenticated-user onboarding, stop until the recorded Supabase Pro upgrade, managed backup, and single-session gates pass.
9. Restate the phase scope and non-goals, implement only that phase, verify it, update this document, and stop.

## Official Sources Rechecked For This Decision

These primary sources were reviewed on 2026-07-19. Recheck them when a later phase depends on current behavior or pricing:

- Vercel monorepos: <https://vercel.com/docs/monorepos>
- Vercel custom domains: <https://vercel.com/docs/domains/set-up-custom-domain>
- Vercel CDN and caching: <https://vercel.com/docs/cdn> and <https://vercel.com/docs/caching/cdn-cache>
- Vercel function regions: <https://vercel.com/docs/functions/configuring-functions/region>
- Vercel Fluid compute: <https://vercel.com/docs/fluid-compute>
- Vercel pricing: <https://vercel.com/pricing>
- Supabase production checklist: <https://supabase.com/docs/guides/deployment/going-into-prod>
- Supabase regions: <https://supabase.com/docs/guides/platform/regions>
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase MFA: <https://supabase.com/docs/guides/auth/auth-mfa>
- Supabase server-side auth: <https://supabase.com/docs/guides/auth/server-side>
- Supabase backups: <https://supabase.com/docs/guides/platform/backups>
- Supabase pricing: <https://supabase.com/pricing>
- GitHub Actions secure use: <https://docs.github.com/en/actions/reference/security/secure-use>
- OWASP ASVS: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Transaction Authorization: <https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html>
- OWASP HTML5 Security: <https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html>
- OWASP File Upload: <https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html>
- NIST SP 800-63-4: <https://www.nist.gov/publications/nist-sp-800-63-4-digital-identity-guidelines>
- OAuth 2.0 Security Best Current Practice, RFC 9700: <https://www.rfc-editor.org/info/rfc9700/>
- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Apple app privacy: <https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/>
- Google Play User Data policy: <https://support.google.com/googleplay/android-developer/answer/17190352>
- Apple account deletion guidance: <https://developer.apple.com/support/offering-account-deletion-in-your-app>
- Google Play account deletion requirements: <https://support.google.com/googleplay/android-developer/answer/13327111>
- WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- Next.js metadata and social images: <https://nextjs.org/docs/app/getting-started/metadata-and-og-images>
- UAE data-protection overview: <https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws>

## Security Handoff Decision For This Documentation Slice

`SECURITY_HANDOFF.md` was updated for MVP Phase 3 because the protected external surface now contains product and draft legal content. It records the static/inactive claim boundary, deployment protection, absence of forms, data credentials, browser data paths, trackers, and cookies, accessibility/security evidence, and the prohibition on relaxing those controls before the separately reviewed Phase 4. The claimant protocol and production-domain security baseline remain unchanged.

## Next Session Opener

Partner, read `HANDOFF.md`, `SECURITY_HANDOFF.md`, `MVP_HANDOFF.md`, and `apps/web/LEGAL_CONTENT_REVIEW.md` first. MVP Phases 1 and 2 are integrated on `main`; Phase 3, protected web authentication, mobile/web crypto compatibility, the global schema-driven owner-vault implementation for all 17 current asset types, mobile forward-field/failure reconciliation, and nonce-based browser-vault security headers are present in the local `codex/mvp-landing-legal` working tree. Development is approved against the existing Free Frankfurt Supabase project plus the local Supabase stack, using test identities and synthetic/tagged records. Do not claim production readiness or onboard external authenticated users until the existing project is upgraded to Pro, managed backups are reviewed, the managed single-session setting is enabled, and mobile-to-web/web-to-mobile displacement tests pass. Preserve and verify the current core-engine diff; do not resume manual web category migrations. Next run the protected synthetic authenticated browser/native smoke matrix across representative field shapes and network-failure recovery, then review the complete local diff for commit. Keep Phase 3 publication blocked, previews protected, `/claim` inactive, and claimant schema/evidence/release work disabled until their separate gates pass.
