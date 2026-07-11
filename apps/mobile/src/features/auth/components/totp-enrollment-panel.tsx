import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  MutedText,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import { createTotpEnrollmentViewModel } from "../totp-enrollment-view-model";

export function TotpEnrollmentPanel() {
  const viewModel = createTotpEnrollmentViewModel();
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 20 }}>
      <StepHeader step="security-1" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <View style={{ alignItems: "center", gap: 14 }}>
        <QrPlaceholder />
        <MutedText style={{ fontSize: 13 }}>
          The QR code appears here once your account is ready.
        </MutedText>
      </View>

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          label={viewModel.primaryActionLabel}
          onPress={() =>
            router.push("/auth/backup-codes?factorId=placeholder-factor-id")
          }
        />
      </View>
    </View>
  );
}

function QrPlaceholder() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.divider,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 12,
        borderWidth: 1,
        height: 158,
        justifyContent: "center",
        width: 158,
      }}
    >
      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
        }}
      >
        <Text
          style={{
            color: colors.inkMuted,
            fontFamily: fonts.mono.regular,
            fontSize: 12,
          }}
        >
          QR code
        </Text>
      </View>
    </View>
  );
}
