import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  Card,
  ListRow,
  MutedText,
  ScreenHeader,
  SectionLabel,
  SerifTitle,
} from "@/shared/ui";

import {
  getVaultCoverageSections,
} from "../vault-navigation-sections";

export function VaultAddMenu() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 22 }}>
      <ScreenHeader
        eyebrow="Dashboard"
        onBack={() => router.replace("/vault")}
      />

      <View style={{ gap: 6 }}>
        <SerifTitle size={30}>Add something new</SerifTitle>
        <MutedText style={{ fontSize: 14.5, lineHeight: 22 }}>
          Choose what you want your family to be able to find.
        </MutedText>
      </View>

      {getVaultCoverageSections().map((section) => (
        <View key={section.id} style={{ gap: 8 }}>
          <SectionLabel>{section.label}</SectionLabel>
          <Card>
            {section.categories.map((category, index) => (
              <ListRow
                isLast={index === section.categories.length - 1}
                key={category.assetType}
                onPress={() => router.push(category.addHref)}
                subtitle="Save a private reference"
                title={category.itemLabel}
              />
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
