# Vault Records UX/Data Hardening Design

## Goal

Improve Phase 1 vault record UX while preserving Sanduqkin's zero-knowledge storage model, strict per-user authorization, and small-slice delivery discipline.

## Product Scope

This track covers saved vault record browsing, creating multiple records per asset class, editing, hard deletion, bulk deletion, and database verification/hardening for the existing Phase 1 single-user vault.

This track does not add beneficiaries, activation flows, witnesses, document upload, production notifications, web app support, payments gating, or server-side plaintext export.

## UX Direction

`Vault` becomes the saved secure records page. It should show saved records grouped or filterable by asset class, with clear empty states and category counts.

`Add <asset class>` pages become creation-only screens. After saving a record, the user should land on the relevant category/list view where the saved record appears as a card and the user can choose `+ Add another <asset class>`.

Each saved record card should show a minimal decrypted summary after unlock, such as a display title and safe secondary labels from the encrypted payload. Each card should expose an overflow menu with:

- `Edit`
- `Delete permanently`

Delete is hard delete only. Confirmation copy must clearly state that deleted encrypted vault records cannot be recovered and Sanduqkin cannot restore them.

Bulk actions should be available from the category/list view:

- enter selection mode
- select records
- delete selected
- delete all in category

All destructive bulk actions require explicit confirmation.

### Bulk Action Interaction

The category header has a page-level three-dot overflow menu. This menu is distinct from each saved record card's existing three-dot menu.

The page-level menu contains:

- `Select records`
- `Delete all`

The card-level menu remains responsible for one record only:

- `Edit`
- `Delete`

Choosing `Select records` enters an explicit selection mode:

- the header shows the selected-record count and a `Cancel` action;
- each record card shows a selection control;
- tapping a card toggles its selection instead of opening record detail;
- card-level overflow menus are hidden while selection mode is active;
- `Delete selected` is available only when at least one record is selected.

`Delete selected` confirmation must state the exact number of records and that deletion is permanent. `Delete all` confirmation must state the category and exact active-record count. Confirmation must use the existing hard-delete path and must not add plaintext database fields or audit metadata.

If any requested deletion fails, the UI must not claim full success. It should remain on the category page, preserve enough state for the user to understand which records remain, and show a safe error without plaintext vault details.

## Visual Direction

Use a restrained glass-inspired design language for saved-record cards, menus, and action surfaces. Because the app is Expo/React Native, do not depend on iOS-only Liquid Glass APIs.

The implementation must degrade cleanly on older Android/iOS devices. Avoid blur-heavy surfaces or effects that make the app fragile or slow on low-end phones. Prefer solid translucent surfaces, borders, shadows, and clear contrast.

## Data Model Direction

Keep the zero-knowledge model. Supabase should store rows, safe metadata, ciphertext, and nonces. Supabase must not store readable vault fields.

Recommended model:

- `vault_assets`
  - one row per saved vault record
  - user-owned via `user_id`
  - category/type via `asset_type` or future `category_key`
  - encrypted payload via `ciphertext` and `nonce`
  - timestamps

- optional safe category metadata table
  - stores category key, label, sort order, and max active records
  - contains no user vault details

Do not add plaintext normalized asset-detail tables such as `bank_accounts`, `properties`, or `contacts` with readable details. A normalized plaintext table design conflicts with the product guardrail that Sanduqkin/Supabase cannot read vault contents.

Multiple records per asset class are represented as multiple `vault_assets` rows.

The maximum active records per user per asset class is 20. Prefer DB-level enforcement through a migration if practical, backed by app validation and tests.

## Security And Authorization

All user-owned tables must have RLS enabled. Policies must ensure authenticated users can only select, insert, update, and delete rows where `user_id = auth.uid()`.

There must be no public or anon access to vault data tables.

Audit events must never contain plaintext vault fields. Safe audit metadata can include asset type/category, action, record id, and counts, but not decrypted field values.

Hard delete should remove the encrypted row from `vault_assets`. If an audit event is written, it should use safe metadata only.

## Reliability And Compatibility

Inputs must accept real-world names and text, including apostrophes, punctuation, and non-harmful special characters. Validation should prevent empty required values and excessive lengths, not normal human names.

The mobile UI must remain usable on older and smaller phones. Text must not overflow buttons/cards, and create/edit flows should work with keyboard and scroll behavior.

Web/Safari compatibility is future-facing. Phase 1 remains mobile-first, but shared validation and data shapes should avoid assumptions that would break future web surfaces.

## Query And Scaling Notes

The primary queries are:

- list active vault records for current user
- list active records for current user and asset class
- fetch one record for current user by id
- insert one encrypted record
- update one encrypted record
- hard delete one or more records owned by current user

Indexes should support `user_id`, `user_id + asset_type`, and active/list ordering. Existing indexes should be verified before adding new ones.

Supabase hosted infrastructure provides connection pooling options. For this mobile client workflow, do not add a custom pooling layer unless a backend workload needs it. Verify Supabase configuration rather than inventing app-level pooling.

## Slice Strategy

Work in small slices:

1. Verify existing database security: RLS, grants, indexes, and zero-knowledge columns.
2. Add or verify DB-level 20-active-record limit per user/category.
3. Refactor Vault navigation so saved records and add forms are separate experiences.
4. Implement the full card/list/add-another/edit/hard-delete flow for bank accounts first.
5. Extend the pattern to all asset classes.
6. Add bulk delete selected/delete all in category.
7. Apply glass-inspired UI polish and low-end-device checks.
8. Update `HANDOFF.md` after each completed slice.

Each slice must include focused automated tests, typecheck where relevant, and Android/emulator verification when the UX changes.
