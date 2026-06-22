import { Stack, useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { DynamicAssetForm , createCryptoAssetPayload , createCryptoFormViewModel , useVaultSession } from "@/features/vault";



import { screenStyles } from "@/shared/ui/screen";

const initialValues: Record<string, string> = {
  approximateValueRange: "prefer_not_to_say",
  country: "",
  cryptoType: "bitcoin",
  documentLocation: "",
  exchangeName: "",
  notes: "",
  title: "",
  walletIdentifier: "",
};

export default function AddCryptoRoute() {
  const { addAsset } = useVaultSession();
  const router = useRouter();
  const viewModel = createCryptoFormViewModel();

  return (
    <>
      <Stack.Screen options={{ title: "Add crypto" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={screenStyles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        <DynamicAssetForm
          categoryLabel="Crypto wallet"
          fields={viewModel.fields}
          initialValues={initialValues}
          onSave={async (values) => {
            const payload = createCryptoAssetPayload({
              approximateValueRange: values.approximateValueRange as
                | "under_50k"
                | "50_200k"
                | "200_500k"
                | "500k_1m"
                | "over_1m"
                | "prefer_not_to_say",
              country: values.country,
              cryptoType: values.cryptoType as "bitcoin" | "ethereum" | "other",
              documentLocation: values.documentLocation || undefined,
              exchangeName: values.exchangeName || undefined,
              notes: values.notes || undefined,
              title: values.title,
              walletIdentifier: values.walletIdentifier,
            });
            await addAsset(payload);
            router.replace("/vault/crypto");
          }}
        />
      </ScrollView>
    </>
  );
}
