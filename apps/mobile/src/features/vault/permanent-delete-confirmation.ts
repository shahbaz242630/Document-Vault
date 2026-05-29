export type PermanentDeleteConfirmationState = {
  pendingAssetId: string | null;
};

type PermanentDeleteRequest = {
  assetId: string;
  state: PermanentDeleteConfirmationState;
};

type PermanentDeleteRequestResult = {
  confirmedAssetId: string | null;
  nextState: PermanentDeleteConfirmationState;
  requiresConfirmation: boolean;
};

export function createPermanentDeleteConfirmationState(): PermanentDeleteConfirmationState {
  return { pendingAssetId: null };
}

export function requestPermanentDelete({
  assetId,
  state,
}: PermanentDeleteRequest): PermanentDeleteRequestResult {
  if (state.pendingAssetId === assetId) {
    return {
      confirmedAssetId: assetId,
      nextState: createPermanentDeleteConfirmationState(),
      requiresConfirmation: false,
    };
  }

  return {
    confirmedAssetId: null,
    nextState: { pendingAssetId: assetId },
    requiresConfirmation: true,
  };
}
