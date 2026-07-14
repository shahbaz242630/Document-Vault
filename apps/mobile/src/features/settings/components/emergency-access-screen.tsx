import { useState } from "react";
import { usePreventScreenCapture } from "expo-screen-capture";
import { Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import {
  CheckboxRow,
  Eyebrow,
  OutlineButton,
  PrimaryButton,
  ScreenHeader,
  SerifTitle,
} from "@/shared/ui";

export type SealedCodeSetupStatus =
  | "none"
  | "pending_confirmation"
  | "active"
  | "interrupted";

type EmergencyAccessScreenProps = {
  activeSealedCodeStatus?: SealedCodeSetupStatus;
  isBusy?: boolean;
  oneTimeCode?: string | null;
  onConfirmSealedCodeWritten?: () => void;
  onCreateSealedCode?: () => Promise<void> | void;
  onRegenerateSealedCode?: () => Promise<void> | void;
  onRevokeSealedCode?: () => Promise<void> | void;
};

export function EmergencyAccessScreen({
  activeSealedCodeStatus = "none",
  isBusy = false,
  oneTimeCode = null,
  onConfirmSealedCodeWritten,
  onCreateSealedCode,
  onRegenerateSealedCode,
  onRevokeSealedCode,
}: EmergencyAccessScreenProps) {
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);

  return (
    <View style={{ gap: 20 }}>
      <ScreenHeader />
      <View style={{ gap: 8 }}>
        <Eyebrow>Emergency access</Eyebrow>
        <SerifTitle size={28}>
          Choose how your next of kin can request access
        </SerifTitle>
      </View>

      <EmergencyOptionCard
        badge="Highly recommended"
        buttonLabel="Set up trusted person"
        description="Invite your trusted person now. They verify their account in advance, and Sanduqkin can release access only after the emergency review process is approved."
        details={[
          "Most secure option.",
          "Your vault remains encrypted.",
          "Sanduqkin cannot read your saved information.",
          "You can remove or replace this person anytime.",
        ]}
        disabled
        title="Pre-Authorized Kin"
      />

      <EmergencyOptionCard
        badge="Backup option"
        buttonLabel={getSealedCodeButtonLabel(activeSealedCodeStatus)}
        description="Create a private emergency code to give to your next of kin or keep with important papers. They will need this code if emergency access is approved."
        details={[
          "Easier if your kin cannot set up an account today.",
          "Sanduqkin cannot recover this code if lost.",
          "Someone with the code may be able to access your vault after emergency approval.",
          "Do not send it by email or chat.",
        ]}
        disabled={isBusy || activeSealedCodeStatus !== "none"}
        onPress={onCreateSealedCode}
        title="Sealed Emergency Code"
      />

      {activeSealedCodeStatus === "none" ? (
        <AcknowledgementPanel
          hasAcknowledgedRisk={hasAcknowledgedRisk}
          isBusy={isBusy}
          onCreateSealedCode={onCreateSealedCode}
          onToggleAcknowledgement={() => setHasAcknowledgedRisk((current) => !current)}
        />
      ) : null}

      {activeSealedCodeStatus === "pending_confirmation" && oneTimeCode ? (
        <OneTimeCodePanel
          code={oneTimeCode}
          isBusy={isBusy}
          onConfirm={onConfirmSealedCodeWritten}
        />
      ) : null}

      {activeSealedCodeStatus === "active" ? (
        <ActiveSealedCodePanel
          isBusy={isBusy}
          onRegenerate={onRegenerateSealedCode}
          onRevoke={onRevokeSealedCode}
        />
      ) : null}

      {activeSealedCodeStatus === "interrupted" ? (
        <InterruptedSealedCodePanel
          isBusy={isBusy}
          onRegenerate={onRegenerateSealedCode}
          onRevoke={onRevokeSealedCode}
        />
      ) : null}
    </View>
  );
}

function AcknowledgementPanel({
  hasAcknowledgedRisk,
  isBusy,
  onCreateSealedCode,
  onToggleAcknowledgement,
}: {
  hasAcknowledgedRisk: boolean;
  isBusy: boolean;
  onCreateSealedCode?: () => Promise<void> | void;
  onToggleAcknowledgement: () => void;
}) {
  return (
    <View style={panelStyle}>
      <Text style={sectionTitleStyle}>Before creating a code</Text>
      <Text style={bodyStyle}>
        Sanduqkin cannot recover this code if lost. Give it to your next of kin
        or keep it with important papers, not in email or chat.
      </Text>
      <CheckboxRow
        checked={hasAcknowledgedRisk}
        label="I understand and will write it down safely."
        onToggle={onToggleAcknowledgement}
      />
      <PrimaryButton
        disabled={!hasAcknowledgedRisk || isBusy}
        label="Create emergency code"
        onPress={() => {
          void onCreateSealedCode?.();
        }}
      />
    </View>
  );
}

function OneTimeCodePanel({
  code,
  isBusy,
  onConfirm,
}: {
  code: string;
  isBusy: boolean;
  onConfirm?: () => void;
}) {
  const [hasCheckedCode, setHasCheckedCode] = useState(false);

  usePreventScreenCapture();

  return (
    <View style={panelStyle}>
      <Text style={sectionTitleStyle}>
        Write this code down now. Sanduqkin cannot show it again after you confirm.
      </Text>
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: colors.gold,
          borderCurve: "continuous",
          borderRadius: 14,
          borderWidth: 1,
          paddingHorizontal: 20,
          paddingVertical: 18,
        }}
      >
        <Text style={codeStyle}>{code}</Text>
      </View>
      <Text style={bodyStyle}>
        Check what you wrote before confirming. If this screen is interrupted,
        regenerate the code before relying on it.
      </Text>
      <CheckboxRow
        checked={hasCheckedCode}
        label="I wrote down and checked this code."
        onToggle={() => setHasCheckedCode((current) => !current)}
      />
      <PrimaryButton
        disabled={!hasCheckedCode || isBusy}
        label="Confirm code is saved"
        onPress={() => onConfirm?.()}
      />
    </View>
  );
}

function ActiveSealedCodePanel({
  isBusy,
  onRegenerate,
  onRevoke,
}: {
  isBusy: boolean;
  onRegenerate?: () => Promise<void> | void;
  onRevoke?: () => Promise<void> | void;
}) {
  return (
    <View style={panelStyle}>
      <Text style={sectionTitleStyle}>Sealed emergency code is active</Text>
      <Text style={bodyStyle}>
        Sanduqkin no longer has the raw code. Regenerate if you need a new copy.
      </Text>
      <OutlineButton
        disabled={isBusy}
        label="Regenerate code"
        onPress={() => {
          void onRegenerate?.();
        }}
      />
      <ActionButton disabled={isBusy} label="Revoke code" onPress={onRevoke} tone="danger" />
    </View>
  );
}

function InterruptedSealedCodePanel({
  isBusy,
  onRegenerate,
  onRevoke,
}: {
  isBusy: boolean;
  onRegenerate?: () => Promise<void> | void;
  onRevoke?: () => Promise<void> | void;
}) {
  return (
    <View style={panelStyle}>
      <Text style={sectionTitleStyle}>Emergency code setup was interrupted</Text>
      <Text style={bodyStyle}>
        The saved grant cannot be trusted because the one-time code was not
        confirmed. Regenerate it or revoke the unusable code.
      </Text>
      <OutlineButton
        disabled={isBusy}
        label="Regenerate code"
        onPress={() => {
          void onRegenerate?.();
        }}
      />
      <ActionButton disabled={isBusy} label="Revoke unusable code" onPress={onRevoke} tone="danger" />
    </View>
  );
}

function EmergencyOptionCard({
  badge,
  buttonLabel,
  description,
  details,
  disabled = false,
  onPress,
  title,
}: {
  badge: string;
  buttonLabel: string;
  description: string;
  details: string[];
  disabled?: boolean;
  onPress?: () => Promise<void> | void;
  title: string;
}) {
  return (
    <View style={cardStyle}>
      <View style={{ gap: 6 }}>
        <Text
          style={{
            color: colors.gold,
            fontFamily: fonts.sans.semibold,
            fontSize: 11.5,
            letterSpacing: 1.3,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </Text>
        <Text
          style={{
            color: colors.ink,
            fontFamily: fonts.serif.medium,
            fontSize: 20,
          }}
        >
          {title}
        </Text>
      </View>

      <Text style={bodyStyle}>{description}</Text>

      <View style={{ gap: 6 }}>
        {details.map((detail) => (
          <Text key={detail} style={detailStyle}>
            {detail}
          </Text>
        ))}
      </View>

      <ActionButton disabled={disabled} label={buttonLabel} onPress={onPress} />
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  tone = "action",
}: {
  disabled: boolean;
  label: string;
  onPress?: () => Promise<void> | void;
  tone?: "action" | "danger";
}) {
  return (
    <Text
      accessibilityRole="button"
      disabled={disabled}
      onPress={
        disabled
          ? undefined
          : () => {
              void onPress?.();
            }
      }
      style={{
        color: disabled
          ? colors.inkMuted
          : tone === "danger"
            ? colors.danger
            : colors.action,
        fontFamily: fonts.sans.semibold,
        fontSize: 15,
        paddingVertical: 6,
        textAlign: "center",
      }}
    >
      {label}
    </Text>
  );
}

function getSealedCodeButtonLabel(status: SealedCodeSetupStatus): string {
  if (status === "active") {
    return "Emergency code active";
  }

  if (status === "interrupted") {
    return "Setup interrupted";
  }

  return "Create emergency code";
}

const cardStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderCurve: "continuous" as const,
  borderRadius: 14,
  borderWidth: 1,
  gap: 12,
  padding: 18,
};

const panelStyle = {
  ...cardStyle,
  backgroundColor: colors.background,
};

const sectionTitleStyle = {
  color: colors.ink,
  fontFamily: fonts.serif.medium,
  fontSize: 18,
};

const bodyStyle = {
  color: colors.inkSecondary,
  fontFamily: fonts.sans.regular,
  fontSize: 14.5,
  lineHeight: 22,
};

const detailStyle = {
  color: colors.inkMuted,
  fontFamily: fonts.sans.regular,
  fontSize: 13.5,
  lineHeight: 20,
};

const codeStyle = {
  color: colors.ink,
  fontFamily: fonts.mono.regular,
  fontSize: 22,
  letterSpacing: 1.5,
};
