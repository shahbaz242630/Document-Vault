import { useRouter } from "expo-router";

import { DynamicAssetForm , createSubscriptionAssetPayload , createSubscriptionFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

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
    <Screen>
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
      </Screen>
  );
}
