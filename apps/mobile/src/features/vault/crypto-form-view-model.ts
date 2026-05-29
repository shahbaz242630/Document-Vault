export type CryptoFormField =
  | {
      helperText?: string;
      label: string;
      name: "title" | "walletIdentifier" | "exchangeName" | "country" | "documentLocation" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "cryptoType";
      options: { label: string; value: "bitcoin" | "ethereum" | "other" }[];
      type: "select";
    }
  | {
      label: string;
      name: "approximateValueRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type CryptoFormViewModel = {
  fields: CryptoFormField[];
};

export function createCryptoFormViewModel(): CryptoFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      {
        label: "Crypto type",
        name: "cryptoType",
        options: [
          { label: "Bitcoin", value: "bitcoin" },
          { label: "Ethereum", value: "ethereum" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      {
        helperText: "A short identifier or the last 4 characters of the wallet address.",
        label: "Wallet identifier",
        name: "walletIdentifier",
        required: true,
        type: "text",
      },
      { label: "Exchange or platform", name: "exchangeName", required: false, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      {
        label: "Approximate value",
        name: "approximateValueRange",
        options: [
          { label: "Under 50K", value: "under_50k" },
          { label: "50–200K", value: "50_200k" },
          { label: "200–500K", value: "200_500k" },
          { label: "500K–1M", value: "500k_1m" },
          { label: "Over 1M", value: "over_1m" },
          { label: "Prefer not to say", value: "prefer_not_to_say" },
        ],
        type: "select",
      },
      { label: "Document location", name: "documentLocation", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
