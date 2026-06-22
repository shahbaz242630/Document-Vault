import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm , createInsuranceAssetPayload , createInsuranceFormViewModel , useVaultSession } from "@/features/vault";



import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  approximateValueRange: "prefer_not_to_say",
  country: "",
  documentLocation: "",
  insuranceContact: "",
  lastFourDigits: "",
  notes: "",
  policyType: "life",
  providerName: "",
  title: "",
};

export default function AddInsuranceRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createInsuranceFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add insurance" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel="Insurance"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createInsuranceAssetPayload({
              approximateValueRange: values.approximateValueRange as
                | "under_50k"
                | "50_200k"
                | "200_500k"
                | "500k_1m"
                | "over_1m"
                | "prefer_not_to_say",
              country: values.country,
              documentLocation: values.documentLocation || undefined,
              insuranceContact: values.insuranceContact || undefined,
              lastFourDigits: values.lastFourDigits,
              notes: values.notes || undefined,
              policyType: values.policyType as "life" | "health" | "property" | "auto" | "other",
              providerName: values.providerName,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/insurance");
          }}
        />
      </ScrollView>
    </>
  );
}
