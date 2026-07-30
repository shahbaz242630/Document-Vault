import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  Card,
  MutedText,
  SectionLabel,
  SerifTitle,
} from "@/shared/ui";

import { createVaultDashboardViewModel } from "../vault-dashboard-view-model";
import type { VaultDecryptedAsset } from "../vault-store";
import { EmergencyAccessDashboardCard } from "./emergency-access-dashboard-card";

type VaultDashboardProps = {
  assets: VaultDecryptedAsset[];
};

export function VaultDashboard({ assets }: VaultDashboardProps) {
  const viewModel = createVaultDashboardViewModel(assets);
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <VaultDashboardHeader />

      <View style={{ gap: 6 }}>
        <SerifTitle size={31}>Everything important, in one place.</SerifTitle>
        <MutedText style={{ fontSize: 14.5, lineHeight: 22 }}>
          Keep a private map of what matters, so your family knows where to look.
        </MutedText>
      </View>

      <CoverageCard
        activeCount={viewModel.activeCount}
        coverageCount={viewModel.coverageCount}
        coverageGroups={viewModel.coverageGroups}
        coveragePercent={viewModel.coveragePercent}
      />

      <View style={{ gap: 10 }}>
        <SectionLabel>What would you like to do?</SectionLabel>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <DashboardAction
            description="Save a private reference"
            icon="plus"
            onPress={() => router.push("/vault/add")}
            title="Add new"
          />
          <DashboardAction
            description={`${viewModel.activeCount} ${
              viewModel.activeCount === 1 ? "record" : "records"
            } stored`}
            icon="records"
            onPress={() => router.push("/vault/records")}
            title="Saved records"
          />
        </View>
      </View>

      <EmergencyAccessDashboardCard
        onOpen={() =>
          router.push(
            "/settings/emergency-access" as unknown as "/settings/re-auth",
          )
        }
      />

      <CheckInCard
        nextSuggestedLabel={viewModel.nextSuggestedGroup?.label ?? null}
      />
    </View>
  );
}

function VaultDashboardHeader() {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <View style={{ gap: 1 }}>
        <Text
          style={{
            color: colors.gold,
            fontFamily: fonts.serif.medium,
            fontSize: 18,
            letterSpacing: 0.4,
          }}
        >
          Sanduqkin
        </Text>
        <MutedText>Private on this device</MutedText>
      </View>
    </View>
  );
}

function CoverageCard({
  activeCount,
  coverageCount,
  coverageGroups,
  coveragePercent,
}: {
  activeCount: number;
  coverageCount: number;
  coverageGroups: ReturnType<
    typeof createVaultDashboardViewModel
  >["coverageGroups"];
  coveragePercent: number;
}) {
  return (
    <Card
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        padding: 20,
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          gap: 20,
        }}
      >
        <CoverageRing
          coverageGroups={coverageGroups}
          coveragePercent={coveragePercent}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <SectionLabel>Vault coverage</SectionLabel>
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.serif.medium,
              fontSize: 22,
              lineHeight: 26,
            }}
          >
            {coverageCount} of 4 life areas
          </Text>
          <MutedText style={{ lineHeight: 19 }}>
            Based on the kinds of references you have saved — never their
            private details.
          </MutedText>
          <Text
            style={{
              color: colors.action,
              fontFamily: fonts.sans.semibold,
              fontSize: 13,
            }}
          >
            {activeCount} encrypted {activeCount === 1 ? "record" : "records"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function CoverageRing({
  coverageGroups,
  coveragePercent,
}: {
  coverageGroups: ReturnType<
    typeof createVaultDashboardViewModel
  >["coverageGroups"];
  coveragePercent: number;
}) {
  const segmentColors = ["#2F6B57", "#4E806E", "#B08D4F", "#D0B878"];

  return (
    <View
      accessibilityLabel={`${coveragePercent}% of vault life areas represented`}
      accessibilityRole="image"
      style={{
        backgroundColor: colors.track,
        borderRadius: 62,
        height: 124,
        overflow: "hidden",
        position: "relative",
        width: 124,
      }}
    >
      {coverageGroups.map((group, index) => (
        <View
          key={group.id}
          style={{
            backgroundColor: group.isCovered
              ? segmentColors[index]
              : colors.track,
            borderColor: colors.surface,
            borderWidth: 2,
            height: 62,
            left: index % 2 === 0 ? 0 : 62,
            position: "absolute",
            top: index < 2 ? 0 : 62,
            width: 62,
          }}
        />
      ))}
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: 42,
          bottom: 20,
          justifyContent: "center",
          left: 20,
          position: "absolute",
          right: 20,
          top: 20,
        }}
      >
        <Text
          style={{
            color: colors.ink,
            fontFamily: fonts.serif.medium,
            fontSize: 25,
          }}
        >
          {coveragePercent}%
        </Text>
        <MutedText style={{ fontSize: 10.5 }}>represented</MutedText>
      </View>
    </View>
  );
}

function DashboardAction({
  description,
  icon,
  onPress,
  title,
}: {
  description: string;
  icon: "plus" | "records";
  onPress: () => void;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#EFE7D6" : colors.surface,
        borderColor: colors.border,
        borderCurve: "continuous",
        borderRadius: 14,
        borderWidth: 1,
        flex: 1,
        gap: 12,
        minHeight: 142,
        opacity: pressed ? 0.9 : 1,
        padding: 17,
      })}
    >
      <ActionGlyph type={icon} />
      <View style={{ gap: 4 }}>
        <Text
          style={{
            color: colors.ink,
            fontFamily: fonts.sans.semibold,
            fontSize: 16,
          }}
        >
          {title}
        </Text>
        <MutedText style={{ fontSize: 12.5, lineHeight: 18 }}>
          {description}
        </MutedText>
      </View>
    </Pressable>
  );
}

function ActionGlyph({ type }: { type: "plus" | "records" }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.successSurface,
        borderRadius: 20,
        height: 40,
        justifyContent: "center",
        width: 40,
      }}
    >
      {type === "plus" ? (
        <Text
          style={{
            color: colors.action,
            fontFamily: fonts.sans.medium,
            fontSize: 28,
            lineHeight: 30,
          }}
        >
          +
        </Text>
      ) : (
        <View style={{ gap: 4 }}>
          {[20, 16, 12].map((width) => (
            <View
              key={width}
              style={{
                backgroundColor: colors.action,
                borderRadius: 2,
                height: 2,
                width,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function CheckInCard({
  nextSuggestedLabel,
}: {
  nextSuggestedLabel: string | null;
}) {
  return (
    <Card style={{ padding: 17 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            backgroundColor: colors.gold,
            borderRadius: 3,
            marginTop: 3,
            width: 4,
          }}
        />
        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={{
              color: colors.ink,
              fontFamily: fonts.sans.semibold,
              fontSize: 14.5,
            }}
          >
            Your next vault check-in
          </Text>
          <MutedText style={{ lineHeight: 20 }}>
            {nextSuggestedLabel
              ? `Consider adding a ${nextSuggestedLabel.toLowerCase()} reference when you are ready.`
              : "All four life areas are represented. Review a record whenever something changes."}
          </MutedText>
        </View>
      </View>
    </Card>
  );
}
