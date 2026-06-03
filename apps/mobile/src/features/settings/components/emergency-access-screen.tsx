import { Pressable, Text, View } from "react-native";

import { colors } from "@/shared/theme/colors";

export function EmergencyAccessScreen() {
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
        title="Pre-Authorized Kin"
      />

      <EmergencyOptionCard
        badge="Backup option"
        buttonLabel="Create emergency code"
        description="Create a private emergency code to give to your next of kin or keep with important papers. They will need this code if emergency access is approved."
        details={[
          "Easier if your kin cannot set up an account today.",
          "Sanduqkin cannot recover this code if lost.",
          "Someone with the code may be able to access your vault after emergency approval.",
          "Do not send it by email or chat.",
        ]}
        title="Sealed Emergency Code"
      />
    </View>
  );
}

function EmergencyOptionCard({
  badge,
  buttonLabel,
  description,
  details,
  title,
}: {
  badge: string;
  buttonLabel: string;
  description: string;
  details: string[];
  title: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.action, fontSize: 13, fontWeight: "700" }}>
          {badge}
        </Text>
        <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "700" }}>
          {title}
        </Text>
      </View>

      <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 22 }}>
        {description}
      </Text>

      <View style={{ gap: 6 }}>
        {details.map((detail) => (
          <Text key={detail} style={{ color: colors.inkMuted, fontSize: 14, lineHeight: 20 }}>
            {detail}
          </Text>
        ))}
      </View>

      <Pressable disabled>
        <Text style={{ color: colors.inkMuted, fontSize: 16 }}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}
