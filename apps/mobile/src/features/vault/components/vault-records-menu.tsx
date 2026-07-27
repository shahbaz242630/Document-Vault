import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  Card,
  EmptyStateCard,
  ListRow,
  MutedText,
  PrimaryButton,
  ScreenHeader,
  SectionLabel,
  SerifTitle,
} from "@/shared/ui";

import { createVaultDashboardViewModel } from "../vault-dashboard-view-model";
import type { VaultDecryptedAsset } from "../vault-store";
import { VaultBottomNavigation } from "./vault-bottom-navigation";

export function VaultRecordsMenu({
  assets,
}: {
  assets: VaultDecryptedAsset[];
}) {
  const router = useRouter();
  const viewModel = createVaultDashboardViewModel(assets);

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader
        eyebrow="Dashboard"
        onBack={() => router.replace("/vault")}
      />

      <View style={{ gap: 6 }}>
        <SerifTitle size={30}>Saved records</SerifTitle>
        <MutedText style={{ fontSize: 14.5, lineHeight: 22 }}>
          {viewModel.activeCount} encrypted{" "}
          {viewModel.activeCount === 1 ? "record" : "records"} across{" "}
          {viewModel.categories.length}{" "}
          {viewModel.categories.length === 1 ? "category" : "categories"}.
        </MutedText>
      </View>

      {viewModel.hasAssets ? (
        <View style={{ gap: 8 }}>
          <SectionLabel>Browse by category</SectionLabel>
          <Card>
            {viewModel.categories.map((category, index) => (
              <ListRow
                isLast={index === viewModel.categories.length - 1}
                key={category.assetType}
                onPress={() =>
                  router.push(category.routeHref as "/vault/export")
                }
                subtitle={`${category.count} ${
                  category.count === 1 ? "record" : "records"
                }`}
                title={category.label}
              />
            ))}
          </Card>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <EmptyStateCard
            description="Add where something lives — not the secret itself. Your family only needs to know where to look."
            title="No saved records yet"
          />
          <PrimaryButton
            label="Add your first record"
            onPress={() => router.push("/vault/add")}
          />
        </View>
      )}

      <View style={{ gap: 8 }}>
        <SectionLabel>Vault tools</SectionLabel>
        <Card>
          <ListRow
            onPress={() => router.push("/vault/export")}
            title="Export as PDF"
          />
          <ListRow
            isLast
            onPress={() => router.push("/vault/recently-deleted")}
            title="Recently deleted"
          />
        </Card>
      </View>

      <VaultBottomNavigation active="records" />
    </View>
  );
}
