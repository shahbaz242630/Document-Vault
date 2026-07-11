import { useRouter } from "expo-router";

import { DynamicAssetForm , createBankAccountAssetPayload , createBankAccountFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

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
    <Screen>
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
            router.replace("/vault/bank-accounts");
          }}
        />
      </Screen>
  );
}
