import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text } from "react-native";

import { AssetDetailView } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { colors } from "@/shared/theme/colors";
import { screenStyles } from "@/shared/ui/screen";

export default function AssetDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { assets, permanentlyDeleteAsset } = useVaultSession();
  const router = useRouter();
  const asset = assets.find((a) => a.id === params.id);

  return (
    <>
      <Stack.Screen options={{ title: "Reference detail" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
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
      </ScrollView>
    </>
  );
}
