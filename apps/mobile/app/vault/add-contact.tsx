import { useRouter } from "expo-router";

import { DynamicAssetForm , createContactAssetPayload , createContactFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

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
    <Screen>
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
            router.replace("/vault/contacts");
          }}
        />
      </Screen>
  );
}
