import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  Card,
  EmptyStateCard,
  ListRow,
  MutedText,
  PillButton,
  SectionLabel,
  SerifTitle,
} from "@/shared/ui";

import { createVaultDashboardViewModel } from "../vault-dashboard-view-model";
import { vaultCategoryConfigs } from "../vault-category-config";
import type { VaultDecryptedAsset } from "../vault-store";

type VaultDashboardProps = {
  assets: VaultDecryptedAsset[];
  onLock?: () => void;
};

type VaultDashboardViewModel = ReturnType<typeof createVaultDashboardViewModel>;
type VaultDashboardCategory = VaultDashboardViewModel["categories"][number];
type VaultDashboardItem = VaultDashboardViewModel["items"][number];

const ADD_LINKS = vaultCategoryConfigs.map(({ addHref, itemLabel }) => [addHref, itemLabel] as const);

export function VaultDashboard({ assets, onLock }: VaultDashboardProps) {
  const viewModel = createVaultDashboardViewModel(assets);
  const router = useRouter();

  return (
    <View style={{ gap: 20 }}>
      <VaultDashboardHeader onLock={onLock} />

      {viewModel.hasAssets ? (
        <Card>
          {viewModel.categories.map((category, index) => (
            <CategoryRow
              category={category}
              isLast={index === viewModel.categories.length - 1}
              key={category.assetType}
            />
          ))}
        </Card>
      ) : (
        <EmptyStateCard
          description="Add where things live — not the things themselves. Most people start with their primary bank account."
          title="Nothing here yet"
        />
      )}

      {viewModel.hasAssets ? <RecentItems items={viewModel.items} /> : null}

      <View style={{ gap: 8 }}>
        <SectionLabel>Add to your vault</SectionLabel>
        <Card>
          {ADD_LINKS.map(([href, label], index) => (
            <ListRow
              isLast={index === ADD_LINKS.length - 1}
              key={href}
              onPress={() => router.push(href)}
              title={label}
            />
          ))}
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>Vault</SectionLabel>
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

      <Card>
        <ListRow
          isLast
          onPress={() =>
            router.push("/settings/emergency-access" as unknown as "/vault/export")
          }
          subtitle="A sealed code for the people you trust"
          title="Emergency access"
        />
      </Card>
    </View>
  );
}

function VaultDashboardHeader({ onLock }: { onLock?: () => void }) {
  const router = useRouter();

  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: 2 }}>
        <SerifTitle size={26}>Your vault</SerifTitle>
        <MutedText>Sealed on this device</MutedText>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <PillButton
          label="Settings"
          onPress={() =>
            router.push("/settings" as unknown as "/vault/export")
          }
        />
        {onLock ? <PillButton label="Lock" onPress={onLock} /> : null}
      </View>
    </View>
  );
}

function CategoryRow({
  category,
  isLast,
}: {
  category: VaultDashboardCategory;
  isLast: boolean;
}) {
  const router = useRouter();

  return (
    <ListRow
      isLast={isLast}
      onPress={() => router.push(category.routeHref as "/vault/export")}
      subtitle={category.count === 1 ? "1 saved" : `${category.count} saved`}
      title={category.label}
    />
  );
}

function RecentItems({ items }: { items: VaultDashboardItem[] }) {
  const router = useRouter();

  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>Records</SectionLabel>
      <Card>
        {items.map((item, index) => (
          <ListRow
            isLast={index === items.length - 1}
            key={item.id}
            onPress={() =>
              router.push({ pathname: "/vault/[id]", params: { id: item.id } })
            }
            subtitle={item.assetTypeLabel}
            title={item.title}
          />
        ))}
      </Card>
    </View>
  );
}
