import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createSubscriptionAssetPayload } from "@/features/vault";
import { createSubscriptionFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  approximateCostRange: "prefer_not_to_say",
  country: "",
  documentLocation: "",
  notes: "",
  serviceName: "",
  subscriptionContact: "",
  subscriptionType: "streaming",
  title: "",
};

export default function AddSubscriptionRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createSubscriptionFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add subscription" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel="Subscription"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createSubscriptionAssetPayload({
              approximateCostRange: values.approximateCostRange as
                | "under_50"
                | "50_200"
                | "200_500"
                | "over_500"
                | "prefer_not_to_say",
              country: values.country,
              documentLocation: values.documentLocation || undefined,
              notes: values.notes || undefined,
              serviceName: values.serviceName,
              subscriptionContact: values.subscriptionContact || undefined,
              subscriptionType: values.subscriptionType as "streaming" | "software" | "utility" | "other",
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/subscriptions");
          }}
        />
      </ScrollView>
    </>
  );
}
