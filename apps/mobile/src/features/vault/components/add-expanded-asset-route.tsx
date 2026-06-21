import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { screenStyles } from "@/shared/ui/screen";

import { DynamicAssetForm } from "./dynamic-asset-form";
import {
  createExpandedAssetPayload,
  getExpandedAssetConfig,
  type ExpandedAssetType,
} from "../expanded-asset-form";
import { getVaultCategoryConfig } from "../vault-category-config";
import { useVaultSession } from "../vault-session-context";

type AddExpandedAssetRouteProps = {
  assetType: ExpandedAssetType;
};

export function AddExpandedAssetRoute({ assetType }: AddExpandedAssetRouteProps) {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const config = getExpandedAssetConfig(assetType);
  const categoryConfig = getVaultCategoryConfig(assetType);

  return (
    <>
      <Stack.Screen options={{ title: `Add ${config.categoryLabel.toLowerCase()}` }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel={config.categoryLabel}
          fields={config.fields}
          initialValues={config.initialValues}
          onSave={async (values) => {
            await addAsset(createExpandedAssetPayload({ assetType, values }));
            router.replace(categoryConfig.routeHref);
          }}
        />
      </ScrollView>
    </>
  );
}
