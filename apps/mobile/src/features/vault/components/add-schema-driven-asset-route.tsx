import { useRouter } from "expo-router";
import {
  createSchemaDrivenVaultPayload,
  getSchemaDrivenVaultCategory,
} from "@vault/shared-validation";

import { Screen } from "@/shared/ui";

import type { AssetType } from "../asset-payload";
import { createSchemaDrivenVaultFormViewModel } from "../schema-driven-form-view-model";
import { getVaultCategoryConfig } from "../vault-category-config";
import { useVaultSession } from "../vault-session-context";
import { DynamicAssetForm } from "./dynamic-asset-form";

export function AddSchemaDrivenAssetRoute({ assetType }: { assetType: AssetType }) {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  const config = createSchemaDrivenVaultFormViewModel(definition);
  const categoryConfig = getVaultCategoryConfig(assetType);

  return <Screen>
    <DynamicAssetForm
      categoryLabel={config.categoryLabel}
      fields={config.fields}
      initialValues={config.initialValues}
      onSave={async (values) => {
        await addAsset(createSchemaDrivenVaultPayload(definition, values));
        router.replace(categoryConfig.routeHref);
      }}
    />
  </Screen>;
}
