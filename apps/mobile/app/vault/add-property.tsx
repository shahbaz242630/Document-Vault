import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createPropertyAssetPayload } from "@/features/vault";
import { createPropertyFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  address: "",
  approximateValueRange: "prefer_not_to_say",
  contact: "",
  country: "",
  documentLocation: "",
  mortgageProvider: "",
  notes: "",
  title: "",
};

export default function AddPropertyRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createPropertyFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add property" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel="Property"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createPropertyAssetPayload({
              address: values.address,
              approximateValueRange: values.approximateValueRange as
                | "under_50k"
                | "50_200k"
                | "200_500k"
                | "500k_1m"
                | "over_1m"
                | "prefer_not_to_say",
              contact: values.contact || undefined,
              country: values.country,
              documentLocation: values.documentLocation || undefined,
              mortgageProvider: values.mortgageProvider || undefined,
              notes: values.notes || undefined,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/properties");
          }}
        />
      </ScrollView>
    </>
  );
}
