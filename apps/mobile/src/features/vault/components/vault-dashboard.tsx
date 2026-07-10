import { Link } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createVaultDashboardViewModel } from "../vault-dashboard-view-model";
import type { VaultDecryptedAsset } from "../vault-store";

type VaultDashboardProps = {
  assets: VaultDecryptedAsset[];
};

type VaultDashboardViewModel = ReturnType<typeof createVaultDashboardViewModel>;
type VaultDashboardCategory = VaultDashboardViewModel["categories"][number];
type VaultDashboardItem = VaultDashboardViewModel["items"][number];

const ADD_LINKS = [
  ["/vault/add-bank-account", "Add bank account"],
  ["/vault/add-card", "Add card"],
  ["/vault/add-investment", "Add investment"],
  ["/vault/add-property", "Add property"],
  ["/vault/add-vehicle", "Add vehicle"],
  ["/vault/add-insurance", "Add insurance"],
  ["/vault/add-crypto", "Add crypto"],
  ["/vault/add-pension", "Add pension"],
  ["/vault/add-loan-debt", "Add loan or debt"],
  ["/vault/add-subscription", "Add subscription"],
  ["/vault/add-document-location", "Add document location"],
  ["/vault/add-contact", "Add contact"],
  ["/vault/add-medical-care", "Add medical care"],
  ["/vault/add-dependent-pet", "Add dependent or pet"],
  ["/vault/add-business-interest", "Add business interest"],
  ["/vault/add-digital-account", "Add digital account"],
  ["/vault/add-other", "Add other"],
] as const;

export function VaultDashboard({ assets }: VaultDashboardProps) {
  const viewModel = createVaultDashboardViewModel(assets);

  if (!viewModel.hasAssets) {
    return <EmptyVaultDashboard />;
  }

  return (
    <View style={{ gap: 20 }}>
      <VaultDashboardHeader activeCount={viewModel.activeCount} />
      <VaultCategoryLinks categories={viewModel.categories} />
      <VaultRecentItemLinks items={viewModel.items} />
      <VaultAddLinks />
      <VaultUtilityLinks />
      <SettingsLink />
    </View>
  );
}

function EmptyVaultDashboard() {
  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          Secure records
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          Your vault is ready.
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          Most people start with their primary bank account. Would you like to add that?
        </Text>
      </View>
      <VaultTextLink href="/vault/add-bank-account" label="Add bank account" />
      <VaultTextLink href="/vault/add-investment" label="Choose a different category" />
      <VaultUtilityLinks />
      <SettingsLink />
    </View>
  );
}

function VaultDashboardHeader({ activeCount }: { activeCount: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Secure records</Text>
      <Text
        style={{
          color: colors.ink,
          fontSize: 30,
          fontWeight: "700",
          lineHeight: 36,
        }}
      >
        {activeCount} active items
      </Text>
    </View>
  );
}

function VaultCategoryLinks({
  categories,
}: {
  categories: VaultDashboardCategory[];
}) {
  return (
    <View style={{ gap: 10 }}>
      {categories.map((category) => (
        <Link
          key={category.assetType}
          href={category.routeHref}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 8,
            borderWidth: 1,
            color: colors.ink,
            fontSize: 17,
            fontWeight: "700",
            padding: 16,
          }}
        >
          {category.label} - {category.count}
        </Link>
      ))}
    </View>
  );
}

function VaultRecentItemLinks({ items }: { items: VaultDashboardItem[] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={{ pathname: "/vault/[id]", params: { id: item.id } }}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: 8,
            borderWidth: 1,
            gap: 4,
            padding: 16,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
            {item.assetTypeLabel}
          </Text>
        </Link>
      ))}
    </View>
  );
}

function VaultAddLinks() {
  return (
    <>
      {ADD_LINKS.map(([href, label]) => (
        <VaultTextLink href={href} key={href} label={label} />
      ))}
    </>
  );
}

function VaultUtilityLinks() {
  return (
    <>
      <Link href="/vault/recently-deleted" style={{ color: colors.inkMuted, fontSize: 15 }}>
        Recently deleted
      </Link>
      <Link href="/vault/export" style={{ color: colors.inkMuted, fontSize: 15 }}>
        Export vault
      </Link>
    </>
  );
}

function VaultTextLink({
  href,
  label,
}: {
  href: (typeof ADD_LINKS)[number][0];
  label: string;
}) {
  return (
    <Link href={href} style={{ color: colors.action, fontSize: 17 }}>
      {label}
    </Link>
  );
}

function SettingsLink() {
  return (
    <Link
      href={"/settings" as unknown as "/auth/sign-up"}
      style={{ color: colors.inkMuted, fontSize: 15 }}
    >
      Account settings
    </Link>
  );
}
