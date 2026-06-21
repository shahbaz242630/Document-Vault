export type VaultBulkSelectionState = {
  isSelecting: boolean;
  selectedIds: string[];
};

export type BulkDeleteMode = "all" | "selected";

export function createVaultBulkSelectionState(): VaultBulkSelectionState {
  return { isSelecting: false, selectedIds: [] };
}

export function enterVaultBulkSelection(
  _state: VaultBulkSelectionState,
): VaultBulkSelectionState {
  return { isSelecting: true, selectedIds: [] };
}

export function cancelVaultBulkSelection(
  _state: VaultBulkSelectionState,
): VaultBulkSelectionState {
  return createVaultBulkSelectionState();
}

export function toggleVaultBulkSelection(
  state: VaultBulkSelectionState,
  assetId: string,
): VaultBulkSelectionState {
  const isSelected = state.selectedIds.includes(assetId);

  return {
    isSelecting: true,
    selectedIds: isSelected
      ? state.selectedIds.filter((id) => id !== assetId)
      : [...state.selectedIds, assetId],
  };
}

export function createBulkDeleteConfirmation({
  count,
  mode,
  title,
}: {
  count: number;
  mode: BulkDeleteMode;
  title: string;
}): string {
  const recordLabel = count === 1 ? "record" : "records";
  const target = mode === "all"
    ? `all ${count} ${recordLabel} in ${title}`
    : `${count} selected ${recordLabel}`;

  return `Delete ${target} permanently? These encrypted records cannot be recovered, and Sanduqkin cannot restore them.`;
}

export async function permanentlyDeleteVaultAssets({
  assetIds,
  deleteAsset,
}: {
  assetIds: string[];
  deleteAsset: (id: string) => Promise<void>;
}): Promise<{ deletedIds: string[]; failedIds: string[] }> {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];

  for (const assetId of assetIds) {
    try {
      await deleteAsset(assetId);
      deletedIds.push(assetId);
    } catch {
      failedIds.push(assetId);
    }
  }

  return { deletedIds, failedIds };
}
