import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createInvestmentAssetPayload } from "@/features/vault";
import { createInvestmentFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  accountType: "brokerage",
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

export default function AddInvestmentRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createInvestmentFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add investment" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <DynamicAssetForm
          categoryLabel="Investment"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createInvestmentAssetPayload({
              accountType: values.accountType as "brokerage" | "retirement" | "mutual_fund" | "other",
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
