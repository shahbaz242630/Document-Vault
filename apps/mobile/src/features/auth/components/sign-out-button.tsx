import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Purchases from "react-native-purchases";

import { colors } from "@/shared/theme/colors";

import { defaultAuditLog } from "../audit-log";
import { createBiometricStorage } from "../biometric-storage";
import { createMekStorage } from "../mek-storage";
import { createSignOutService } from "../sign-out-service";
import { createSignupProgressStorage } from "../signup-progress";
import { createSignOutViewModel } from "../sign-out-view-model";

type SecureStorage = {
  deleteItemAsync: (key: string) => Promise<void>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

type SignOutButtonProps = {
  storage: SecureStorage | null;
  vaultSignOut: () => void;
};

export function SignOutButton({ storage, vaultSignOut }: SignOutButtonProps) {
  const viewModel = createSignOutViewModel();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const service = useMemo(
    () =>
      createSignOutService({
        auditLog: defaultAuditLog,
        biometricStorage: createBiometricStorage(storage),
        mekStorage: createMekStorage(storage),
        progressStorage: createSignupProgressStorage(storage),
        vaultSignOut,
      }),
    [storage, vaultSignOut],
  );

  if (isSigningOut) {
    return (
      <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
        Signing out...
      </Text>
    );
  }

  if (isConfirming) {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "700" }}>
          {viewModel.confirmationTitle}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
          {viewModel.confirmationBody}
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsConfirming(false)}
            style={{
              alignItems: "center",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: "continuous",
              borderRadius: 8,
              borderWidth: 1,
              flex: 1,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 17 }}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              setIsSigningOut(true);
              try {
                await service.signOut();
                try {
                  await Purchases.logOut();
                } catch {
                  // Ignore RevenueCat logout errors (e.g., not configured).
                }
                router.replace("/");
              } catch {
                setIsSigningOut(false);
                setIsConfirming(false);
              }
            }}
            style={{
              alignItems: "center",
              backgroundColor: colors.danger,
              borderCurve: "continuous",
              borderRadius: 8,
              flex: 1,
              paddingHorizontal: 18,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                color: colors.actionText,
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {viewModel.actionLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => setIsConfirming(true)}
      style={{
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}
    >
      <Text
        style={{ color: colors.danger, fontSize: 17, textAlign: "center" }}
      >
        {viewModel.actionLabel}
      </Text>
    </Pressable>
  );
}
