import { Stack } from "expo-router";
import { ScrollView, Text } from "react-native";

import { colors } from "@/shared/theme/colors";
import { screenStyles } from "@/shared/ui/screen";

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
    <>
      <Stack.Screen options={{ title: config.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        {isReady ? (
          <VaultCategoryList
            onDeleteAsset={permanentlyDeleteAsset}
            viewModel={viewModel}
          />
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>Opening vault...</Text>
        )}
      </ScrollView>
    </>
  );
}
