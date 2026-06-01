import { Link } from "expo-router";
import { Text, View } from "react-native";

import { BiometricPreferencesPanel, SignOutButton } from "@/features/auth";
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
  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Account</Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          Settings
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {isPremium === true ? (
          <>
            <Text
              style={{
                color: colors.action,
                fontSize: 17,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              ✦ Premium Active
            </Text>
            <Link
              href="/settings/customer-center"
              style={{
                color: colors.ink,
                fontSize: 17,
                textAlign: "center",
              }}
            >
              Manage subscription
            </Link>
          </>
        ) : isPremium === false ? (
          <Link
            href="/settings/paywall"
            style={{
              color: colors.action,
              fontSize: 17,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            Upgrade to Premium
          </Link>
        ) : null}

        <BiometricPreferencesPanel storage={storage} />

        <SignOutButton storage={storage} vaultSignOut={vaultSignOut} />

        <Link
          href="/settings/re-auth"
          style={{
            color: colors.danger,
            fontSize: 17,
            textAlign: "center",
          }}
        >
          Delete account
        </Link>
      </View>
    </View>
  );
}
