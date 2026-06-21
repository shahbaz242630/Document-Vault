# Vault Records UX/Data Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Phase 1 vault records UX and database hardening while preserving zero-knowledge encrypted storage and strict user isolation.

**Architecture:** Keep `vault_assets` as the encrypted record table with one row per saved record. Normalize only safe metadata and verification logic; do not add plaintext asset-detail tables. Build the new UX as a saved-record Vault/category experience plus creation-only add forms, starting with bank accounts.

**Tech Stack:** Expo React Native, Expo Router, TypeScript, Vitest, Supabase/Postgres migrations and RLS policies.

---

## File Map

- Modify: `HANDOFF.md`
  - Track every completed slice and any live QA findings.
- Modify: `apps/mobile/src/shared/api/supabase-schema.test.ts`
  - Add local migration guard coverage for grants, RLS policies, indexes, zero-knowledge column rules, and future max-record-limit migration.
- Create/modify: `supabase/migrations/<timestamp>_vault_asset_active_record_limit.sql`
  - Add DB-level enforcement for max 20 active records per user per asset class if current schema does not already enforce it.
- Modify: `apps/mobile/src/features/vault/vault-session.ts`
  - Adjust delete behavior to support direct hard delete from active records.
- Modify: `apps/mobile/src/features/vault/vault-store.ts`
  - Remove or bypass soft-delete requirement for the new hard-delete path.
- Modify: `apps/mobile/src/features/vault/vault-store.test.ts`
  - Assert hard delete removes active records directly and cannot be restored.
- Modify: `apps/mobile/src/features/vault/vault-session.test.ts`
  - Assert repository hard delete is called directly for active records.
- Modify: `apps/mobile/src/features/vault/vault-session-context.tsx`
  - Ensure hard-delete audit events contain only safe metadata.
- Modify/create vault list/card components under `apps/mobile/src/features/vault/components/`
  - Saved record cards, overflow menu, hard-delete confirmation, category list, bulk selection controls.
- Modify routes under `apps/mobile/app/vault/`
  - Make `Vault` the saved-record page.
  - Keep `Add <asset class>` routes creation-only.
  - Route after save to the relevant category/list view.
- Modify asset form view-models under `apps/mobile/src/features/vault/`
  - Keep required fields minimal and labels visible.
  - Preserve zero-knowledge encrypted payload construction.

---

### Task 1: Strengthen Database Security Guard Tests

**Files:**
- Modify: `apps/mobile/src/shared/api/supabase-schema.test.ts`

- [ ] **Step 1: Add failing tests for strict vault table security**

Add assertions that all user-owned vault/emergency/account tables enable RLS, revoke anon/public access, and use `auth.uid() = user_id` policies.

- [ ] **Step 2: Run the focused schema test**

Run:

```powershell
npm run test --workspace @vault/mobile -- supabase-schema.test.ts
```

Expected: initially pass for existing covered tables, or fail only where the schema guard exposes a real gap.

- [ ] **Step 3: Fix only real local migration guard gaps**

If a guard fails because the migration text is missing a required revoke, grant, index, or RLS policy, add a migration or update the guard only after confirming the existing migration state.

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test --workspace @vault/mobile -- supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
```

- [ ] **Step 5: Update handoff**

Record the DB security guard result in `HANDOFF.md`.

---

### Task 2: Add Max 20 Active Records Per User/Asset Type

**Files:**
- Modify: `apps/mobile/src/shared/api/supabase-schema.test.ts`
- Create: `supabase/migrations/<timestamp>_vault_asset_active_record_limit.sql`

- [ ] **Step 1: Add failing schema guard**

Assert migrations include a trigger/function or constraint that prevents more than 20 active `vault_assets` rows for the same `user_id` and `asset_type`.

- [ ] **Step 2: Add migration**

Create a migration that:

- defines a function to count active rows where `deleted_at is null`
- raises an exception when inserting a new active record beyond 20
- applies the trigger before insert/update on `public.vault_assets`
- does not inspect or decrypt `ciphertext`

- [ ] **Step 3: Verify locally through tests**

Run:

```powershell
npm run test --workspace @vault/mobile -- supabase-schema.test.ts
```

- [ ] **Step 4: Apply remotely only after review**

Use Supabase CLI migration flow. Do not store DB passwords or tokens in files.

- [ ] **Step 5: Update handoff**

Record migration name, test result, and whether remote migration was applied.

---

### Task 3: Convert Delete UX To Direct Hard Delete For Bank Accounts

**Files:**
- Modify: `apps/mobile/src/features/vault/vault-store.test.ts`
- Modify: `apps/mobile/src/features/vault/vault-session.test.ts`
- Modify: `apps/mobile/src/features/vault/vault-store.ts`
- Modify: `apps/mobile/src/features/vault/vault-session.ts`
- Modify: `apps/mobile/src/features/vault/vault-session-context.tsx`

- [x] **Step 1: Write failing domain tests**

Assert an active record can be permanently deleted directly and is removed from active records without first entering a soft-deleted state.

- [x] **Step 2: Update store/session behavior**

Implement direct hard delete while preserving repository delete calls and safe audit event behavior.

- [x] **Step 3: Run focused tests**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-store.test.ts vault-session.test.ts vault-session-context.test.ts
```

- [x] **Step 4: Update handoff**

Record the domain behavior change and tests.

---

### Task 4: Build Bank Account Category List And Cards

**Files:**
- Create/modify components under `apps/mobile/src/features/vault/components/`
- Modify route files under `apps/mobile/app/vault/`
- Test route/component behavior under `apps/mobile/src/app-route-tests/` or feature tests outside `apps/mobile/app/`

- [x] **Step 1: Add tests for post-save navigation and card rendering**

Assert saving a bank account lands on a bank-account list/category screen that shows the new card and `+ Add another bank account`.

- [x] **Step 2: Implement list/card UI**

Add saved-record cards with a glass-inspired but fallback-safe surface: solid translucent background, border, small shadow, no required blur dependency.

- [x] **Step 3: Add card overflow menu**

Menu actions:

- `Edit`
- `Delete permanently`

- [x] **Step 4: Add delete confirmation**

Use irreversible copy:

```text
This record will be removed from Sanduqkin and cannot be recovered. Sanduqkin cannot restore deleted encrypted vault records.
```

- [x] **Step 5: Verify**

Run focused route/component tests and:

```powershell
npm run typecheck --workspace @vault/mobile
```

- [x] **Step 6: Android QA**

Verify on emulator:

- add bank account
- saved card appears
- `+ Add another bank account` opens a fresh form
- edit opens the existing record
- delete confirmation hard deletes the card

Status 2026-06-19: complete. Live Android add/save/card/menu/edit/permanent-delete QA
passed, including metadata-only Supabase verification and database hard deletion.

- [x] **Step 7: Update handoff**

Record test commands and Android QA result.

---

### Task 5: Extend Pattern To All Asset Classes

**Files:**
- Modify/create shared category list/card helpers
- Modify routes for all add/edit asset classes
- Modify tests for route/category behavior

- [x] **Step 1: Extract reusable category list behavior**

Avoid duplicating card/menu/delete logic across each asset class.

- [x] **Step 2: Apply to remaining asset classes**

Apply the bank-account pattern to investment, property, insurance, crypto, pension, subscription, document location, contact, other, and expanded MVP categories.

- [x] **Step 3: Verify**

Run focused tests and mobile typecheck.

- [x] **Step 4: Update handoff**

Record covered categories and remaining gaps.

---

### Task 6: Add Bulk Delete Controls

**Files:**
- Modify category list components
- Add tests for selection and bulk destructive confirmations

- [x] **Step 1: Add selection-mode tests**

Assert users can enter selection mode, select records, and cancel selection.

- [x] **Step 2: Add delete selected**

Require confirmation and hard-delete selected owned records.

- [x] **Step 3: Add delete all in category**

Require confirmation and hard-delete all active records in that category.

- [x] **Step 4: Verify**

Run focused tests, typecheck, and Android QA for one category.

- [x] **Step 5: Update handoff**

Record behavior and verification.

---

### Task 7: Final UX Polish And Compatibility Checks

**Files:**
- Modify shared UI styles/components touched by vault lists and forms
- Update tests where text/layout expectations exist

- [ ] **Step 1: Review text fitting and small-screen behavior**

Check long labels, category names, names with apostrophes, and long user-entered display titles.

- [ ] **Step 2: Apply glass-inspired fallback-safe styling**

Use restrained surfaces and avoid blur as a dependency.

- [ ] **Step 3: Run checks**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-session-context.test.ts emergency-access-route.test.ts supabase-emergency-grant-repository.test.ts sealed-emergency-code-service.test.ts supabase-schema.test.ts
npm run typecheck --workspace @vault/mobile
```

- [ ] **Step 4: Android QA**

Open app on emulator and verify create/list/edit/delete flows still work.

- [ ] **Step 5: Update handoff**

Record final status and remaining Phase 1 blockers.
