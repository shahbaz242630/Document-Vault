import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";

import { DynamicAssetForm , getEditAssetConfig , useVaultSession } from "@/features/vault";


import { colors } from "@/shared/theme/colors";
import { Screen } from "@/shared/ui";

export default function EditAssetRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { assets, isReady, updateAsset } = useVaultSession();
  const router = useRouter();
  const asset = assets.find((a) => a.id === params.id);

  if (!asset) {
    return (
      <Screen>
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>
            Reference not found.
          </Text>
        </Screen>
    );
  }

  const config = getEditAssetConfig(asset.assetType);
  const initialValues = config.getInitialValues(asset);

  return (
    <Screen>
        {isReady ? (
          <DynamicAssetForm
            categoryLabel={config.categoryLabel}
            fields={config.fields}
            initialValues={initialValues}
            mode="edit"
            onSave={async (values) => {
              const payload = config.createPayload(values, asset.fields);
              await updateAsset(asset.id, payload);
              router.replace({ pathname: "/vault/[id]", params: { id: asset.id } });
            }}
          />
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>
            Opening vault...
          </Text>
        )}
      </Screen>
  );
}
