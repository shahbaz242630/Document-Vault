import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createOtherAssetPayload } from "@/features/vault";
import { createOtherFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

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
    <>
      <Stack.Screen options={{ title: "Add other asset" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
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
      </ScrollView>
    </>
  );
}
