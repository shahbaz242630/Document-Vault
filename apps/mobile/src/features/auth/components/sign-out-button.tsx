import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Purchases from "react-native-purchases";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

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
    return <SigningOutMessage />;
  }

  if (isConfirming) {
    return (
      <SignOutConfirmation
        actionLabel={viewModel.actionLabel}
        body={viewModel.confirmationBody}
        onCancel={() => setIsConfirming(false)}
        onConfirm={async () => {
          setIsSigningOut(true);
          try {
            await service.signOut();
            await logOutRevenueCat();
            router.replace("/");
          } catch {
            setIsSigningOut(false);
            setIsConfirming(false);
          }
        }}
        title={viewModel.confirmationTitle}
      />
    );
  }

  return <SignOutTrigger label={viewModel.actionLabel} onPress={() => setIsConfirming(true)} />;
}

function SigningOutMessage() {
  return (
    <Text style={{ color: colors.inkMuted, fontFamily: fonts.sans.regular, fontSize: 15 }}>
      Signing out...
    </Text>
  );
}

function SignOutConfirmation({
  actionLabel,
  body,
  onCancel,
  onConfirm,
  title,
}: {
  actionLabel: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  title: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: colors.ink, fontFamily: fonts.sans.semibold, fontSize: 16 }}>
        {title}
      </Text>
      <Text style={{ color: colors.inkSoft, fontFamily: fonts.sans.regular, fontSize: 15, lineHeight: 22 }}>
        {body}
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <CancelSignOutButton onCancel={onCancel} />
        <ConfirmSignOutButton actionLabel={actionLabel} onConfirm={onConfirm} />
      </View>
    </View>
  );
}

function CancelSignOutButton({ onCancel }: { onCancel: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onCancel}
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
      <Text style={{ color: colors.ink, fontFamily: fonts.sans.regular, fontSize: 16 }}>Cancel</Text>
    </Pressable>
  );
}

function ConfirmSignOutButton({
  actionLabel,
  onConfirm,
}: {
  actionLabel: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        void onConfirm();
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
          fontFamily: fonts.sans.semibold,
          fontSize: 16,
        }}
      >
        {actionLabel}
      </Text>
    </Pressable>
  );
}

function SignOutTrigger({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}
    >
      <Text
        style={{ color: colors.danger, fontFamily: fonts.sans.regular, fontSize: 15, textAlign: "center" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

async function logOutRevenueCat() {
  try {
    await Purchases.logOut();
  } catch {
    // Ignore RevenueCat logout errors (e.g., not configured).
  }
}
