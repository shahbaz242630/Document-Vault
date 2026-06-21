import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createPensionAssetPayload } from "@/features/vault";
import { createPensionFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  approximateValueRange: "prefer_not_to_say",
  country: "",
  documentLocation: "",
  lastFourDigits: "",
  notes: "",
  pensionContact: "",
  pensionProvider: "",
  title: "",
};

export default function AddPensionRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createPensionFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add pension" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel="Pension"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createPensionAssetPayload({
              approximateValueRange: values.approximateValueRange as
                | "under_50k"
                | "50_200k"
                | "200_500k"
                | "500k_1m"
                | "over_1m"
                | "prefer_not_to_say",
              country: values.country,
              documentLocation: values.documentLocation || undefined,
              lastFourDigits: values.lastFourDigits,
              notes: values.notes || undefined,
              pensionContact: values.pensionContact || undefined,
              pensionProvider: values.pensionProvider,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/pensions");
          }}
        />
      </ScrollView>
    </>
  );
}
