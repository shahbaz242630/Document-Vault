import { useRouter } from "expo-router";

import { DynamicAssetForm , createPropertyAssetPayload , createPropertyFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

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
    <Screen>
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
      </Screen>
  );
}
