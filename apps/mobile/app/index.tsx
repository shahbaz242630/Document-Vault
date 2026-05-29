import { ScrollView } from "react-native";

import { WelcomePanel } from "@/features/onboarding/components/welcome-panel";
import { screenStyles } from "@/shared/ui/screen";

export default function HomeRoute() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={screenStyles.content}
    >
      <WelcomePanel />
    </ScrollView>
  );
}
