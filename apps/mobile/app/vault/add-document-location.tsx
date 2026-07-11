import { useRouter } from "expo-router";

import { DynamicAssetForm , createDocumentLocationAssetPayload , createDocumentLocationFormViewModel , useVaultSession } from "@/features/vault";



import { Screen } from "@/shared/ui";

const initialValues: Record<string, string> = {
  country: "",
  custodian: "",
  documentType: "will",
  location: "",
  notes: "",
  title: "",
};

export default function AddDocumentLocationRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createDocumentLocationFormViewModel();

  return (
    <Screen>
        <DynamicAssetForm
          categoryLabel="Document location"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createDocumentLocationAssetPayload({
              country: values.country,
              custodian: values.custodian || undefined,
              documentType: values.documentType as "will" | "deed" | "passport" | "other",
              location: values.location,
              notes: values.notes || undefined,
              title: values.title,
            });
            await addAsset(payload);
            router.replace("/vault/document-locations");
          }}
        />
      </Screen>
  );
}
