# Vault Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add discoverable category-level selection, delete-selected, and delete-all controls while preserving per-card Edit/Delete behavior and zero-knowledge hard deletion.

**Architecture:** Keep interaction state in a small pure `vault-bulk-selection` module and render it from the shared `VaultCategoryList`. Use the existing `permanentlyDeleteAsset(id)` path for each selected id, collect failures explicitly, and keep selection mode open when any deletion fails. The category route remains the boundary that supplies the deletion callback.

**Tech Stack:** Expo React Native, React state, Expo Router, TypeScript, Vitest.

**Status (2026-06-21):** Completed. Test-first implementation, Android delete-selected/delete-all QA, authenticated Supabase hard-delete verification, focused regression tests, and mobile typecheck all passed. The Phase 1 guard still fails on known function-size debt tracked in `HANDOFF.md`.

---

## File Map

- Create: `apps/mobile/src/features/vault/vault-bulk-selection.ts`
  - Pure selection state, confirmation copy, and sequential deletion result collection.
- Create: `apps/mobile/src/features/vault/vault-bulk-selection.test.ts`
  - Test selection transitions, destructive confirmation text, and partial failures.
- Modify: `apps/mobile/src/features/vault/components/vault-category-list.tsx`
  - Page overflow menu, selection UI, destructive confirmations, and safe error state.
- Modify: `apps/mobile/src/features/vault/components/vault-category-route.tsx`
  - Continue passing the existing permanent-delete callback into the shared list.
- Modify: `apps/mobile/src/features/vault/index.ts`
  - Export bulk-selection helpers used by tests/consumers.
- Modify: `docs/superpowers/plans/2026-06-12-vault-records-ux-data-hardening.md`
  - Mark Task 6 steps as completed only after verification.
- Modify: `HANDOFF.md`
  - Record automated checks and Android QA.

### Task 1: Pure Selection State

**Files:**
- Create: `apps/mobile/src/features/vault/vault-bulk-selection.test.ts`
- Create: `apps/mobile/src/features/vault/vault-bulk-selection.ts`

- [ ] **Step 1: Write the failing selection tests**

Add tests that define the state API:

```ts
const initial = createVaultBulkSelectionState();
expect(initial).toEqual({ isSelecting: false, selectedIds: [] });

const selecting = enterVaultBulkSelection(initial);
expect(selecting).toEqual({ isSelecting: true, selectedIds: [] });

const oneSelected = toggleVaultBulkSelection(selecting, "asset-1");
expect(oneSelected.selectedIds).toEqual(["asset-1"]);

expect(toggleVaultBulkSelection(oneSelected, "asset-1").selectedIds).toEqual([]);
expect(cancelVaultBulkSelection(oneSelected)).toEqual(initial);
```

Also assert that duplicate ids never enter the selection and that toggling preserves deterministic item order.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test --workspace @vault/mobile -- vault-bulk-selection.test.ts
```

Expected: FAIL because `vault-bulk-selection.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal pure state API**

Create these exports:

```ts
export type VaultBulkSelectionState = {
  isSelecting: boolean;
  selectedIds: string[];
};

export function createVaultBulkSelectionState(): VaultBulkSelectionState;
export function enterVaultBulkSelection(
  state: VaultBulkSelectionState,
): VaultBulkSelectionState;
export function cancelVaultBulkSelection(
  state: VaultBulkSelectionState,
): VaultBulkSelectionState;
export function toggleVaultBulkSelection(
  state: VaultBulkSelectionState,
  assetId: string,
): VaultBulkSelectionState;
```

`toggleVaultBulkSelection` removes an existing id or appends a missing id. It must not mutate the input state.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same Vitest command. Expected: all selection tests pass.

### Task 2: Confirmation And Partial-Failure Behavior

**Files:**
- Modify: `apps/mobile/src/features/vault/vault-bulk-selection.test.ts`
- Modify: `apps/mobile/src/features/vault/vault-bulk-selection.ts`

- [ ] **Step 1: Write failing confirmation and deletion tests**

Specify exact copy:

```ts
expect(createBulkDeleteConfirmation({ count: 2, mode: "selected", title: "Bank accounts" }))
  .toBe("Delete 2 selected records permanently? These encrypted records cannot be recovered, and Sanduqkin cannot restore them.");

expect(createBulkDeleteConfirmation({ count: 3, mode: "all", title: "Bank accounts" }))
  .toBe("Delete all 3 records in Bank accounts permanently? These encrypted records cannot be recovered, and Sanduqkin cannot restore them.");
```

Specify sequential result collection:

```ts
const result = await permanentlyDeleteVaultAssets({
  assetIds: ["asset-1", "asset-2", "asset-3"],
  deleteAsset: async (id) => {
    if (id === "asset-2") throw new Error("network");
  },
});

expect(result).toEqual({
  deletedIds: ["asset-1", "asset-3"],
  failedIds: ["asset-2"],
});
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL because confirmation and deletion helpers are missing.

- [ ] **Step 3: Implement the helpers**

Add:

```ts
export type BulkDeleteMode = "all" | "selected";

export function createBulkDeleteConfirmation(input: {
  count: number;
  mode: BulkDeleteMode;
  title: string;
}): string;

export async function permanentlyDeleteVaultAssets(input: {
  assetIds: string[];
  deleteAsset: (id: string) => Promise<void>;
}): Promise<{ deletedIds: string[]; failedIds: string[] }>;
```

The deletion helper catches per-id failures, never includes error messages or vault payloads in its result, and continues so the UI can report partial completion accurately.

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: all bulk-selection tests pass.

### Task 3: Shared Category UI

**Files:**
- Modify: `apps/mobile/src/features/vault/components/vault-category-list.tsx`
- Modify: `apps/mobile/src/features/vault/index.ts`

- [ ] **Step 1: Add failing source guard assertions**

Extend `vault-bulk-selection.test.ts` with a source guard that reads `components/vault-category-list.tsx` and asserts the shared component contains these user-facing labels:

```ts
expect(source).toContain("Select records");
expect(source).toContain("Delete all");
expect(source).toContain("Delete selected");
expect(source).toContain("Cancel");
```

Also assert it imports and calls `permanentlyDeleteVaultAssets` so bulk deletion cannot silently bypass result collection.

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL because the UI does not yet contain the bulk controls.

- [ ] **Step 3: Implement the page overflow and selection mode**

In `VaultCategoryList` add state for:

```ts
const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);
const [bulkSelection, setBulkSelection] = useState(createVaultBulkSelectionState);
const [pendingBulkDeleteMode, setPendingBulkDeleteMode] =
  useState<BulkDeleteMode | null>(null);
const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
const [isBulkDeleting, setIsBulkDeleting] = useState(false);
```

Normal state requirements:

- page-level `...` accessibility label: `Open category actions`;
- menu actions `Select records` and `Delete all`;
- `Delete all` is hidden when the category is empty;
- existing card-level Edit/Delete menu remains unchanged.

Selection state requirements:

- header text uses `${bulkSelection.selectedIds.length} selected`;
- `Cancel` clears selection, confirmation, and safe error state;
- card press toggles selection and does not link to record detail;
- selected cards expose `accessibilityState={{ selected: true }}`;
- card overflow actions are hidden;
- `Delete selected` renders only when at least one id is selected.

- [ ] **Step 4: Implement explicit confirmation and execution**

The first destructive press sets `pendingBulkDeleteMode`. Render `createBulkDeleteConfirmation(...)` and require a second press labeled `Delete permanently`.

For selected deletion, pass `bulkSelection.selectedIds`. For delete-all, pass `viewModel.items.map((item) => item.id)`.

Call `permanentlyDeleteVaultAssets`. If `failedIds` is empty, exit selection mode and clear confirmation. Otherwise keep selection mode active with only `failedIds` selected and show:

```text
Some records could not be deleted. Try again.
```

Disable destructive controls while `isBulkDeleting` is true.

- [ ] **Step 5: Run focused tests and typecheck**

```powershell
npm run test --workspace @vault/mobile -- vault-bulk-selection.test.ts permanent-delete-confirmation.test.ts vault-category-list-view-model.test.ts vault-category-routes.test.ts
npm run typecheck --workspace @vault/mobile
```

Expected: all tests and typecheck pass.

### Task 4: Android QA And Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-06-12-vault-records-ux-data-hardening.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run Android selection-mode QA**

On `Pixel_7`, verify a category with at least two test records:

- page overflow opens;
- `Select records` enters selection mode;
- selecting one card shows `1 selected`;
- `Cancel` restores normal navigation and card menus;
- selected deletion requires two presses and permanently removes only selected test records.

- [ ] **Step 2: Run Android delete-all QA**

Create disposable test records, choose `Delete all`, verify exact count/category confirmation, confirm, and verify the category empty state. Do not delete the retained recovery-continuity record; use a disposable category if necessary.

- [ ] **Step 3: Verify Supabase hard deletion**

Use the authenticated test-account API to query safe metadata only. Confirm deleted ids return zero rows and no plaintext vault fields are queried or printed.

- [ ] **Step 4: Run final automated verification**

```powershell
npm run test --workspace @vault/mobile -- vault-bulk-selection.test.ts permanent-delete-confirmation.test.ts vault-category-list-view-model.test.ts vault-category-routes.test.ts vault-session-context.test.ts
npm run typecheck --workspace @vault/mobile
```

- [ ] **Step 5: Update plan and handoff**

Mark Task 6 complete only when both delete-selected and delete-all checks pass. Record exact test counts, Android results, and metadata-only Supabase verification in `HANDOFF.md`. Never record passwords, tokens, ciphertext, or plaintext vault data.
