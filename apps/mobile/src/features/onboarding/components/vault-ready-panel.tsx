import { useRouter } from "expo-router";
import { View } from "react-native";

import {
  Eyebrow,
  GoldHairline,
  Padlock,
  PrimaryButton,
  SerifTitle,
  Subtitle,
} from "@/shared/ui";

export function VaultReadyPanel() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, gap: 22, justifyContent: "center" }}>
      <Padlock size="small" state="sealing" />
      <Eyebrow>All set</Eyebrow>
      <SerifTitle size={40}>Your vault is sealed and yours alone.</SerifTitle>
      <GoldHairline animated delayMs={1000} />
      <Subtitle style={{ fontSize: 16, lineHeight: 26 }}>
        {"Password, second lock, and recovery phrase — all in place. Let's add the first thing your family might need."}
      </Subtitle>
      <PrimaryButton
        label="Go to your vault"
        onPress={() => router.replace("/vault")}
        style={{ marginTop: 12 }}
      />
    </View>
  );
}
