import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm } from "@/features/vault";
import { createContactAssetPayload } from "@/features/vault";
import { createContactFormViewModel } from "@/features/vault";
import { useVaultSession } from "@/features/vault";
import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  country: "",
  email: "",
  name: "",
  notes: "",
  phone: "",
  relationship: "lawyer",
};

export default function AddContactRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createContactFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add contact" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.content}
      >
        <DynamicAssetForm
          categoryLabel="Contact"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createContactAssetPayload({
              country: values.country,
              email: values.email || undefined,
              name: values.name,
              notes: values.notes || undefined,
              phone: values.phone || undefined,
              relationship: values.relationship as
                | "lawyer"
                | "accountant"
                | "employer"
                | "embassy"
                | "other",
            });
            await addAsset(payload);
            router.replace("/vault");
          }}
        />
      </ScrollView>
    </>
  );
}
