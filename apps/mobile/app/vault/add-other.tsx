import { useRouter } from "expo-router";

import { DynamicAssetForm , createOtherAssetPayload , createOtherFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

const initialValues: Record<string, string> = {
  approximateValue: "",
  category: "",
  country: "",
  description: "",
  documentLocation: "",
  notes: "",
  title: "",
};

export default function AddOtherRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createOtherFormViewModel();

  return (
    <Screen>
        <DynamicAssetForm
          categoryLabel="Other"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createOtherAssetPayload({
              approximateValue: values.approximateValue || undefined,
              category: values.category || undefined,
              country: values.country,
              description: values.description || undefined,
              documentLocation: values.documentLocation || undefined,
              notes: values.notes || undefined,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/other-records");
          }}
        />
      </Screen>
  );
}
