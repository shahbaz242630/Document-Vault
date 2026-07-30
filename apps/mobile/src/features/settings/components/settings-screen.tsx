import { useRouter } from "expo-router";
import { View } from "react-native";

import { BiometricPreferencesPanel, SignOutButton } from "@/features/auth";
import {
  Card,
  ListRow,
  ScreenHeader,
  SectionLabel,
  SerifTitle,
} from "@/shared/ui";
import { colors } from "@/shared/theme/colors";

type SettingsScreenProps = {
  isPremium?: boolean;
  storage: {
    deleteItemAsync: (key: string) => Promise<void>;
    getItemAsync: (key: string) => Promise<string | null>;
    setItemAsync: (key: string, value: string) => Promise<void>;
  } | null;
  vaultSignOut: () => void;
};

export function SettingsScreen({
  isPremium,
  storage,
  vaultSignOut,
}: SettingsScreenProps) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 18 }}>
      <ScreenHeader
        eyebrow="Dashboard"
        onBack={() => router.replace("/vault")}
      />
      <SerifTitle size={28}>Settings</SerifTitle>

      <View style={{ gap: 8 }}>
        <SectionLabel>Security</SectionLabel>
        <BiometricPreferencesPanel storage={storage} />
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>Vault</SectionLabel>
        <Card>
          <ListRow
            isLast
            onPress={() =>
              router.push("/settings/emergency-access" as unknown as "/settings/re-auth")
            }
            title="Emergency access"
          />
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>Account</SectionLabel>
        <Card>
          {isPremium === true ? (
            <ListRow
              onPress={() => router.push("/settings/customer-center")}
              title="Sanduqkin Premium"
              value="Active"
            />
          ) : isPremium === false ? (
            <ListRow
              onPress={() => router.push("/settings/paywall")}
              title="Sanduqkin Premium"
              value="Upgrade"
            />
          ) : null}
          <ListRow
            isLast
            onPress={() => router.push("/settings/re-auth")}
            showChevron={false}
            title="Delete account"
            titleColor={colors.danger}
          />
        </Card>
      </View>

      <SignOutButton storage={storage} vaultSignOut={vaultSignOut} />
    </View>
  );
}
