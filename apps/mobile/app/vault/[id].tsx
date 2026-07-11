import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";

import { AssetDetailView , useVaultSession } from "@/features/vault";

import { colors } from "@/shared/theme/colors";
import { Screen } from "@/shared/ui";

export default function AssetDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { assets, permanentlyDeleteAsset } = useVaultSession();
  const router = useRouter();
  const asset = assets.find((a) => a.id === params.id);

  return (
    <Screen>
        {asset ? (
          <AssetDetailView
            asset={asset}
            onDelete={async (id) => {
              await permanentlyDeleteAsset(id);
              router.replace("/vault");
            }}
            onEdit={() => {
              router.push({ pathname: "/vault/edit-asset", params: { id: asset.id } });
            }}
          />
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>
            Reference not found.
          </Text>
        )}
      </Screen>
  );
}
