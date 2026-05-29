import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

import { createBackupCodesViewModel } from "../backup-codes-view-model";

type BackupCodesPanelProps = {
  factorId: string;
};

export function BackupCodesPanel({ factorId }: BackupCodesPanelProps) {
  const viewModel = createBackupCodesViewModel();
  const [acknowledged, setAcknowledged] = useState(false);

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

      <View style={{ gap: 10 }}>
        {viewModel.codes.map((code, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: "continuous",
              borderRadius: 8,
              borderWidth: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Text
              selectable
              style={{
                color: colors.ink,
                fontFamily: "monospace",
                fontSize: 17,
                letterSpacing: 1,
              }}
            >
              {code}
            </Text>
          </View>
        ))}
      </View>

      <Text
        selectable
        style={{ color: colors.danger, fontSize: 15, lineHeight: 22 }}
      >
        {viewModel.warning}
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => setAcknowledged((current) => !current)}
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 12,
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: acknowledged ? colors.action : colors.surface,
            borderColor: acknowledged ? colors.action : colors.border,
            borderCurve: "continuous",
            borderRadius: 6,
            borderWidth: 2,
            height: 24,
            justifyContent: "center",
            width: 24,
          }}
        >
          {acknowledged ? (
            <Text style={{ color: colors.actionText, fontSize: 14 }}>✓</Text>
          ) : null}
        </View>
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15, lineHeight: 22 }}>
          {viewModel.acknowledgmentLabel}
        </Text>
      </Pressable>

      {acknowledged ? (
        <Link
          href={{
            pathname: "/auth/verify-totp",
            params: { factorId },
          }}
          style={{
            alignItems: "center",
            backgroundColor: colors.action,
            borderCurve: "continuous",
            borderRadius: 8,
            color: colors.actionText,
            fontSize: 17,
            fontWeight: "700",
            paddingHorizontal: 18,
            paddingVertical: 14,
            textAlign: "center",
          }}
        >
          {viewModel.primaryActionLabel}
        </Link>
      ) : (
        <View
          style={{
            alignItems: "center",
            backgroundColor: colors.inkMuted,
            borderCurve: "continuous",
            borderRadius: 8,
            paddingHorizontal: 18,
            paddingVertical: 14,
          }}
        >
          <Text style={{ color: colors.actionText, fontSize: 17, fontWeight: "700" }}>
            {viewModel.primaryActionLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
