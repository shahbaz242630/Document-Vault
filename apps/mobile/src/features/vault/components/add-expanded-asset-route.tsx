import { useRouter } from "expo-router";

import { Screen } from "@/shared/ui";

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
    <Screen>
      <DynamicAssetForm
        categoryLabel={config.categoryLabel}
        fields={config.fields}
        initialValues={config.initialValues}
        onSave={async (values) => {
          await addAsset(createExpandedAssetPayload({ assetType, values }));
          router.replace(categoryConfig.routeHref);
        }}
      />
    </Screen>
  );
}
