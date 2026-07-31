import { View } from "react-native";

import {
  BodyText,
  Card,
  Eyebrow,
  NoticeBox,
  ScreenHeader,
  SectionLabel,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

export function TrustedPersonInformationScreen() {
  return (
    <View style={{ flex: 1, gap: 18 }}>
      <ScreenHeader />

      <View style={{ gap: 8 }}>
        <Eyebrow>Emergency access</Eyebrow>
        <SerifTitle size={28}>Trusted person setup</SerifTitle>
        <Subtitle>
          Prepare for a future verified-recipient connection without weakening
          your vault encryption.
        </Subtitle>
      </View>

      <NoticeBox title="Setup is not available yet" variant="success">
        No invitation has been created and no personal details have been
        collected. Sanduqkin will enable setup only after the recipient-key
        security checks are approved.
      </NoticeBox>

      <View style={{ gap: 8 }}>
        <SectionLabel>How it will work</SectionLabel>
        <Card style={{ gap: 14, padding: 18 }}>
          <BodyText>
            1. You nominate a trusted person using a value-free invitation.
          </BodyText>
          <BodyText>
            2. They verify their account and create a protected key on an
            eligible device.
          </BodyText>
          <BodyText>
            3. You unlock your vault and approve an encrypted grant addressed
            only to that key.
          </BodyText>
          <BodyText>
            4. They still need the full identity, evidence, review, and
            approval process before any release.
          </BodyText>
        </Card>
      </View>

      <View style={{ gap: 8 }}>
        <SectionLabel>Important</SectionLabel>
        <Card style={{ gap: 12, padding: 18 }}>
          <BodyText>
            Naming someone does not automatically give them access and does not
            establish legal next-of-kin status.
          </BodyText>
          <BodyText>
            Sanduqkin cannot read your vault, and the future recipient must
            decrypt approved release material locally.
          </BodyText>
        </Card>
      </View>
    </View>
  );
}
