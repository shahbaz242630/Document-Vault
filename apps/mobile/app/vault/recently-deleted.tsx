import { Stack } from "expo-router/stack";
import { ScrollView, Text } from "react-native";

import { RecentlyDeletedList , useVaultSession } from "@/features/vault";
import { colors } from "@/shared/theme/colors";
import { screenStyles } from "@/shared/ui/screen";

export default function RecentlyDeletedRoute() {
  const { deletedAssets, isReady, permanentlyDeleteAsset, restoreAsset } = useVaultSession();

  return (
    <>
      <Stack.Screen options={{ title: "Recently deleted" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        {isReady ? (
          <RecentlyDeletedList
            assets={deletedAssets}
            onPermanentlyDeleteAsset={permanentlyDeleteAsset}
            onRestoreAsset={restoreAsset}
          />
        ) : (
          <Text style={{ color: colors.inkMuted, fontSize: 17 }}>Opening vault...</Text>
        )}
      </ScrollView>
    </>
  );
}
