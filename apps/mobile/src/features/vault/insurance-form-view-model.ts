export type InsuranceFormField =
  | {
      helperText?: string;
      keyboardType?: "numeric";
      label: string;
      name: "title" | "providerName" | "country" | "lastFourDigits" | "documentLocation" | "insuranceContact" | "notes";
      required: boolean;
      type: "text";
    }
  | {
    label: string;
    name: "policyType";
    options: { label: string; value: "life" | "health" | "property" | "auto" | "other" }[];
    type: "select";
  }
  | {
      label: string;
      name: "approximateValueRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type InsuranceFormViewModel = {
  fields: InsuranceFormField[];
};

export function createInsuranceFormViewModel(): InsuranceFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Provider name", name: "providerName", required: true, type: "text" },
      {
        label: "Policy type",
        name: "policyType",
        options: [
          { label: "Life", value: "life" },
          { label: "Health", value: "health" },
          { label: "Property", value: "property" },
          { label: "Auto", value: "auto" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      {
        helperText: "Only the last 4 digits of the policy number.",
        keyboardType: "numeric",
        label: "Policy number",
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
      { label: "Contact at provider", name: "insuranceContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
