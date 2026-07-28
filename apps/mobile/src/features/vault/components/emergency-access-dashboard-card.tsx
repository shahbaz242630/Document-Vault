import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import { Card, MutedText, SectionLabel } from "@/shared/ui";

import {
  createEmergencyAccessDashboardViewModel,
  createEmergencyAccessReminderDismissedUntil,
  deriveEmergencyAccessDashboardStatus,
  emergencyAccessPendingConfirmationKey,
  emergencyAccessReminderDismissedUntilKey,
  type EmergencyAccessDashboardStatus,
} from "../emergency-access-dashboard-status";
import {
  createSupabaseEmergencyGrantRepository,
  type SupabaseEmergencyGrantClient,
} from "../supabase-emergency-grant-repository";
import { useVaultSession } from "../vault-session-context";

type EmergencyAccessDashboardCardProps = {
  onOpen: () => void;
};

export function EmergencyAccessDashboardCard({
  onOpen,
}: EmergencyAccessDashboardCardProps) {
  const { dismissReminder, reminderDismissedUntil, status } =
    useEmergencyAccessDashboardState();
  const viewModel = createEmergencyAccessDashboardViewModel(
    status,
    reminderDismissedUntil,
  );
  const isLoading = status === "loading";
  const statusColor =
    viewModel.tone === "success"
      ? colors.action
      : viewModel.tone === "attention"
        ? colors.gold
        : colors.inkMuted;

  return (
    <View style={{ gap: 9 }}>
      <SectionLabel>Emergency readiness</SectionLabel>
      <Card
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          gap: 14,
          padding: 17,
        }}
      >
        <EmergencyAccessSummary
          body={viewModel.body}
          icon={viewModel.icon}
          label={viewModel.label}
          statusColor={statusColor}
        />
        <EmergencyAccessAction
          actionLabel={viewModel.actionLabel}
          isLoading={isLoading}
          onOpen={onOpen}
        />
        {viewModel.showReminder ? (
          <EmergencyAccessReminder onDismiss={dismissReminder} />
        ) : null}
      </Card>
    </View>
  );
}

function EmergencyAccessSummary({
  body,
  icon,
  label,
  statusColor,
}: {
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  statusColor: string;
}) {
  return (
    <View
      style={{
        alignItems: "flex-start",
        flexDirection: "row",
        gap: 13,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 22,
          height: 44,
          justifyContent: "center",
          width: 44,
        }}
      >
        <Ionicons color={statusColor} name={icon} size={24} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.sans.semibold,
              fontSize: 15.5,
            }}
          >
            Vault emergency access
          </Text>
          <Text
            style={{
              color: statusColor,
              fontFamily: fonts.sans.semibold,
              fontSize: 11.5,
            }}
          >
            {label}
          </Text>
        </View>
        <MutedText style={{ lineHeight: 20 }}>{body}</MutedText>
      </View>
    </View>
  );
}

function EmergencyAccessAction({
  actionLabel,
  isLoading,
  onOpen,
}: {
  actionLabel: string;
  isLoading: boolean;
  onOpen: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={actionLabel}
      accessibilityRole="button"
      disabled={isLoading}
      onPress={onOpen}
      style={({ pressed }) => ({
        alignItems: "center",
        alignSelf: "flex-start",
        flexDirection: "row",
        gap: 5,
        opacity: isLoading ? 0.55 : pressed ? 0.6 : 1,
        paddingVertical: 2,
      })}
    >
      <Text
        style={{
          color: colors.action,
          fontFamily: fonts.sans.semibold,
          fontSize: 14,
        }}
      >
        {actionLabel}
      </Text>
      {!isLoading ? (
        <Ionicons color={colors.action} name="arrow-forward" size={16} />
      ) : null}
    </Pressable>
  );
}

function EmergencyAccessReminder({ onDismiss }: { onDismiss: () => void }) {
  return (
    <View
      accessibilityLabel="Emergency access reminder"
      style={{
        borderTopColor: colors.divider,
        borderTopWidth: 1,
        gap: 6,
        paddingTop: 12,
      }}
    >
      <Text
        style={{
          color: colors.inkSoft,
          fontFamily: fonts.sans.medium,
          fontSize: 13,
          lineHeight: 19,
        }}
      >
        A small setup now can make a difficult moment easier for your family.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onDismiss}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        <Text
          style={{
            color: colors.inkMuted,
            fontFamily: fonts.sans.medium,
            fontSize: 12.5,
          }}
        >
          Remind me in 7 days
        </Text>
      </Pressable>
    </View>
  );
}

function useEmergencyAccessDashboardState() {
  const { supabaseClient } = useVaultSession();
  const [status, setStatus] =
    useState<EmergencyAccessDashboardStatus>("loading");
  const [reminderDismissedUntil, setReminderDismissedUntil] = useState<
    string | null
  >(null);
  const repository = useMemo(
    () =>
      supabaseClient
        ? createSupabaseEmergencyGrantRepository(
            supabaseClient as unknown as SupabaseEmergencyGrantClient,
          )
        : null,
    [supabaseClient],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadStatus() {
        if (!repository) {
          if (isActive) {
            setStatus("unavailable");
          }
          return;
        }

        setStatus("loading");
        try {
          const [activeGrant, pendingConfirmation, dismissedUntil] =
            await Promise.all([
              repository.loadActiveSealedCodeGrant(),
              SecureStore.getItemAsync(emergencyAccessPendingConfirmationKey),
              SecureStore.getItemAsync(
                emergencyAccessReminderDismissedUntilKey,
              ),
            ]);

          if (isActive) {
            setReminderDismissedUntil(dismissedUntil);
            setStatus(
              deriveEmergencyAccessDashboardStatus({
                hasActiveGrant: Boolean(activeGrant),
                hasPendingConfirmation: Boolean(pendingConfirmation),
              }),
            );
          }
        } catch {
          if (isActive) {
            setStatus("unavailable");
          }
        }
      }

      void loadStatus();

      return () => {
        isActive = false;
      };
    }, [repository]),
  );

  const dismissReminder = useCallback(() => {
    const dismissedUntil = createEmergencyAccessReminderDismissedUntil();
    setReminderDismissedUntil(dismissedUntil);
    void SecureStore.setItemAsync(
      emergencyAccessReminderDismissedUntilKey,
      dismissedUntil,
    );
  }, []);

  return { dismissReminder, reminderDismissedUntil, status };
}
