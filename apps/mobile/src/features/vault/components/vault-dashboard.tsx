import { Link } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createVaultDashboardViewModel } from "../vault-dashboard-view-model";
import type { VaultDecryptedAsset } from "../vault-store";

type VaultDashboardProps = {
  assets: VaultDecryptedAsset[];
};

export function VaultDashboard({ assets }: VaultDashboardProps) {
  const viewModel = createVaultDashboardViewModel(assets);

  if (!viewModel.hasAssets) {
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
        <Link href="/vault/add-bank-account" style={{ color: colors.action, fontSize: 17 }}>
          Add bank account
        </Link>
        <Link href="/vault/add-investment" style={{ color: colors.action, fontSize: 17 }}>
          Choose a different category
        </Link>
        <Link href="/vault/recently-deleted" style={{ color: colors.inkMuted, fontSize: 15 }}>
          Recently deleted
        </Link>
        <Link href="/vault/export" style={{ color: colors.inkMuted, fontSize: 15 }}>
          Export vault
        </Link>
        <SettingsLink />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
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
          {viewModel.activeCount} active items
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {viewModel.categories.map((category) => (
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

      <View style={{ gap: 10 }}>
        {viewModel.items.map((item) => (
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

      <Link href="/vault/add-bank-account" style={{ color: colors.action, fontSize: 17 }}>
        Add bank account
      </Link>
      <Link href="/vault/add-card" style={{ color: colors.action, fontSize: 17 }}>
        Add card
      </Link>
      <Link href="/vault/add-investment" style={{ color: colors.action, fontSize: 17 }}>
        Add investment
      </Link>
      <Link href="/vault/add-property" style={{ color: colors.action, fontSize: 17 }}>
        Add property
      </Link>
      <Link href="/vault/add-vehicle" style={{ color: colors.action, fontSize: 17 }}>
        Add vehicle
      </Link>
      <Link href="/vault/add-insurance" style={{ color: colors.action, fontSize: 17 }}>
        Add insurance
      </Link>
      <Link href="/vault/add-crypto" style={{ color: colors.action, fontSize: 17 }}>
        Add crypto
      </Link>
      <Link href="/vault/add-pension" style={{ color: colors.action, fontSize: 17 }}>
        Add pension
      </Link>
      <Link href="/vault/add-loan-debt" style={{ color: colors.action, fontSize: 17 }}>
        Add loan or debt
      </Link>
      <Link href="/vault/add-subscription" style={{ color: colors.action, fontSize: 17 }}>
        Add subscription
      </Link>
      <Link href="/vault/add-document-location" style={{ color: colors.action, fontSize: 17 }}>
        Add document location
      </Link>
      <Link href="/vault/add-contact" style={{ color: colors.action, fontSize: 17 }}>
        Add contact
      </Link>
      <Link href="/vault/add-medical-care" style={{ color: colors.action, fontSize: 17 }}>
        Add medical care
      </Link>
      <Link href="/vault/add-dependent-pet" style={{ color: colors.action, fontSize: 17 }}>
        Add dependent or pet
      </Link>
      <Link href="/vault/add-business-interest" style={{ color: colors.action, fontSize: 17 }}>
        Add business interest
      </Link>
      <Link href="/vault/add-digital-account" style={{ color: colors.action, fontSize: 17 }}>
        Add digital account
      </Link>
      <Link href="/vault/add-other" style={{ color: colors.action, fontSize: 17 }}>
        Add other
      </Link>
      <Link href="/vault/recently-deleted" style={{ color: colors.inkMuted, fontSize: 15 }}>
        Recently deleted
      </Link>
      <Link href="/vault/export" style={{ color: colors.inkMuted, fontSize: 15 }}>
        Export vault
      </Link>
      <SettingsLink />
    </View>
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
