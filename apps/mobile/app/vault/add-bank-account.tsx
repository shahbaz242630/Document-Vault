import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createBankAccountAssetPayload } from "@/features/vault";
import { createBankAccountFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  approximateValueRange: "prefer_not_to_say",
  country: "",
  currency: "",
  documentLocation: "",
  institutionContact: "",
  institutionName: "",
  lastFourDigits: "",
  notes: "",
  title: "",
};

export default function AddBankAccountRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createBankAccountFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add bank account" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <DynamicAssetForm
          categoryLabel="Bank account"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createBankAccountAssetPayload({
              approximateValueRange: values.approximateValueRange as
                | "under_50k"
                | "50_200k"
                | "200_500k"
                | "500k_1m"
                | "over_1m"
                | "prefer_not_to_say",
              country: values.country,
              currency: values.currency,
              documentLocation: values.documentLocation || undefined,
              institutionContact: values.institutionContact || undefined,
              institutionName: values.institutionName,
              lastFourDigits: values.lastFourDigits,
              notes: values.notes || undefined,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault");
          }}
        />
      </ScrollView>
    </>
  );
}
