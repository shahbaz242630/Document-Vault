export type PensionFormField =
  | {
      helperText?: string;
      keyboardType?: "numeric";
      label: string;
      name: "title" | "pensionProvider" | "country" | "lastFourDigits" | "documentLocation" | "pensionContact" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "approximateValueRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type PensionFormViewModel = {
  fields: PensionFormField[];
};

export function createPensionFormViewModel(): PensionFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Pension provider", name: "pensionProvider", required: true, type: "text" },
      {
        helperText: "Only the last 4 digits of the policy or account number.",
        keyboardType: "numeric",
        label: "Account number",
        name: "lastFourDigits",
        required: true,
        type: "text",
      },
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
      { label: "Contact at provider", name: "pensionContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
