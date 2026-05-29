import { Link } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createTotpEnrollmentViewModel } from "../totp-enrollment-view-model";

export function TotpEnrollmentPanel() {
  const viewModel = createTotpEnrollmentViewModel();

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>
          {viewModel.statusLabel}
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 30,
            fontWeight: "700",
            lineHeight: 36,
          }}
        >
          {viewModel.title}
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {viewModel.body}
        </Text>
      </View>

      <Link
        href="/auth/backup-codes?factorId=placeholder-factor-id"
        style={{ color: colors.action, fontSize: 17 }}
      >
        {viewModel.primaryActionLabel}
      </Link>
    </View>
  );
}
