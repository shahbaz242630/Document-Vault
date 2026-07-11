import { useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  Card,
  CheckboxRow,
  MutedText,
  PrimaryButton,
  SerifTitle,
  StepHeader,
  Subtitle,
} from "@/shared/ui";

import { createBackupCodesViewModel } from "../backup-codes-view-model";

type BackupCodesPanelProps = {
  factorId: string;
};

export function BackupCodesPanel({ factorId }: BackupCodesPanelProps) {
  const viewModel = createBackupCodesViewModel();
  const [acknowledged, setAcknowledged] = useState(false);
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 20 }}>
      <StepHeader step="security-2" />

      <View style={{ gap: 10 }}>
        <SerifTitle>{viewModel.title}</SerifTitle>
        <Subtitle>{viewModel.body}</Subtitle>
      </View>

      <BackupCodeGrid codes={viewModel.codes} />

      <MutedText>{viewModel.warning}</MutedText>

      <CheckboxRow
        checked={acknowledged}
        label={viewModel.acknowledgmentLabel}
        onToggle={() => setAcknowledged((current) => !current)}
      />

      <View style={{ marginTop: "auto" }}>
        <PrimaryButton
          disabled={!acknowledged}
          label={viewModel.primaryActionLabel}
          onPress={() =>
            router.push({
              pathname: "/auth/verify-totp",
              params: { factorId },
            })
          }
        />
      </View>
    </View>
  );
}

function BackupCodeGrid({ codes }: { codes: readonly string[] }) {
  return (
    <Card
      style={{
        columnGap: 12,
        flexDirection: "row",
        flexWrap: "wrap",
        padding: 18,
        rowGap: 12,
      }}
    >
      {codes.map((code) => (
        <Text
          key={code}
          selectable
          style={{
            color: colors.ink,
            flexBasis: "45%",
            flexGrow: 1,
            fontFamily: fonts.mono.regular,
            fontSize: 15,
            textAlign: "center",
          }}
        >
          {code}
        </Text>
      ))}
    </Card>
  );
}
