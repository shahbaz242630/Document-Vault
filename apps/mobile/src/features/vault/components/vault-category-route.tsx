import { MutedText, Screen } from "@/shared/ui";

import type { VaultCategoryConfig } from "../vault-category-config";
import { createVaultCategoryListViewModel } from "../vault-category-list-view-model";
import { useVaultSession } from "../vault-session-context";
import { VaultCategoryList } from "./vault-category-list";

type VaultCategoryRouteProps = {
  config: VaultCategoryConfig;
};

export function VaultCategoryRoute({ config }: VaultCategoryRouteProps) {
  const { assets, isReady, permanentlyDeleteAsset } = useVaultSession();
  const viewModel = createVaultCategoryListViewModel({
    addHref: config.addHref,
    addLabel: config.addLabel,
    assetType: config.assetType,
    assets,
    emptyTitle: config.emptyTitle,
    title: config.title,
  });

  return (
    <Screen>
      {isReady ? (
        <VaultCategoryList
          onDeleteAsset={permanentlyDeleteAsset}
          viewModel={viewModel}
        />
      ) : (
        <MutedText style={{ fontSize: 17 }}>Opening vault...</MutedText>
      )}
    </Screen>
  );
}
