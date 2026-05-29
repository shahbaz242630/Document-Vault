import { Link, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createEmailVerificationViewModel } from "../email-verification-view-model";

export function EmailVerificationPanel() {
  const params = useLocalSearchParams<{ email?: string }>();
  const viewModel = createEmailVerificationViewModel(params.email);

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Email verification</Text>
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
          We sent the next setup step to {viewModel.destinationLabel}.
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 17, lineHeight: 25 }}>
          {viewModel.body}
        </Text>
      </View>

      <Link
        href={{
          pathname: "/auth/profile-basics",
          params: { email: params.email ?? "" },
        }}
        style={{ color: colors.action, fontSize: 17 }}
      >
        Continue to profile setup
      </Link>
    </View>
  );
}
