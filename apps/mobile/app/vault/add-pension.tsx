import { useRouter } from "expo-router";

import { DynamicAssetForm , createPensionAssetPayload , createPensionFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

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
    <Screen>
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
      </Screen>
  );
}
