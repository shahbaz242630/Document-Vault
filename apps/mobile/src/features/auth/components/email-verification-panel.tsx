import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import { createEmailVerificationViewModel } from "../email-verification-view-model";

export function EmailVerificationPanel() {
  const params = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const viewModel = createEmailVerificationViewModel(params.email);

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <StepHeader step="account-2" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>
          We sent the next setup step to{" "}
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.sans.semibold,
            }}
          >
            {viewModel.destinationLabel}
          </Text>
          . {viewModel.body}
        </Subtitle>
      </View>

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          label="Continue to profile setup"
          onPress={() =>
            router.push({
              pathname: "/auth/profile-basics",
              params: { email: params.email ?? "" },
            })
          }
        />
      </View>
    </View>
  );
}
