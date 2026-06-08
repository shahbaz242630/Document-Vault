import { useState } from "react";
import { usePreventScreenCapture } from "expo-screen-capture";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

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
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.inkMuted, fontSize: 15 }}>Emergency access</Text>
        <Text
          style={{
            color: colors.ink,
            fontSize: 28,
            fontWeight: "700",
            lineHeight: 34,
          }}
        >
          Choose how your next of kin can request access
        </Text>
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
      <Pressable onPress={onToggleAcknowledgement} style={{ paddingVertical: 4 }}>
        <Text style={bodyStyle}>
          {hasAcknowledgedRisk ? "[x]" : "[ ]"} I understand and will write it
          down safely.
        </Text>
      </Pressable>
      <ActionButton
        disabled={!hasAcknowledgedRisk || isBusy}
        label="Create emergency code"
        onPress={onCreateSealedCode}
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
      <Text style={codeStyle}>{code}</Text>
      <Text style={bodyStyle}>
        Check what you wrote before confirming. If this screen is interrupted,
        regenerate the code before relying on it.
      </Text>
      <Pressable onPress={() => setHasCheckedCode((current) => !current)}>
        <Text style={bodyStyle}>
          {hasCheckedCode ? "[x]" : "[ ]"} I wrote down and checked this code.
        </Text>
      </Pressable>
      <ActionButton
        disabled={!hasCheckedCode || isBusy}
        label="Confirm code is saved"
        onPress={onConfirm}
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
      <ActionButton disabled={isBusy} label="Regenerate code" onPress={onRegenerate} />
      <ActionButton disabled={isBusy} label="Revoke code" onPress={onRevoke} />
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
      <ActionButton disabled={isBusy} label="Regenerate code" onPress={onRegenerate} />
      <ActionButton disabled={isBusy} label="Revoke unusable code" onPress={onRevoke} />
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
        <Text style={{ color: colors.action, fontSize: 13, fontWeight: "700" }}>
          {badge}
        </Text>
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700" }}>
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
}: {
  disabled: boolean;
  label: string;
  onPress?: () => Promise<void> | void;
}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ paddingVertical: 4 }}>
      <Text style={{ color: disabled ? colors.inkMuted : colors.action, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
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
  borderRadius: 8,
  borderWidth: 1,
  gap: 12,
  padding: 16,
};

const panelStyle = {
  ...cardStyle,
  backgroundColor: colors.background,
};

const sectionTitleStyle = {
  color: colors.ink,
  fontSize: 18,
  fontWeight: "700" as const,
};

const bodyStyle = {
  color: colors.inkSoft,
  fontSize: 15,
  lineHeight: 22,
};

const detailStyle = {
  color: colors.inkMuted,
  fontSize: 14,
  lineHeight: 20,
};

const codeStyle = {
  color: colors.ink,
  fontSize: 22,
  fontWeight: "700" as const,
  letterSpacing: 0,
};
