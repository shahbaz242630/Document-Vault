export type InvestmentFormField =
  | {
      helperText?: string;
      keyboardType?: "numeric";
      label: string;
      name: "title" | "institutionName" | "country" | "currency" | "lastFourDigits" | "documentLocation" | "institutionContact" | "notes";
      required: boolean;
      type: "text";
    }
  | {
      label: string;
      name: "accountType";
      options: { label: string; value: "brokerage" | "retirement" | "mutual_fund" | "other" }[];
      type: "select";
    }
  | {
      label: string;
      name: "approximateValueRange";
      options: { label: string; value: string }[];
      type: "select";
    };

export type InvestmentFormViewModel = {
  fields: InvestmentFormField[];
};

export function createInvestmentFormViewModel(): InvestmentFormViewModel {
  return {
    fields: [
      { label: "Title", name: "title", required: true, type: "text" },
      { label: "Institution name", name: "institutionName", required: true, type: "text" },
      {
        label: "Account type",
        name: "accountType",
        options: [
          { label: "Brokerage", value: "brokerage" },
          { label: "Retirement", value: "retirement" },
          { label: "Mutual fund", value: "mutual_fund" },
          { label: "Other", value: "other" },
        ],
        type: "select",
      },
      {
        helperText: "Only the last 4 digits.",
        keyboardType: "numeric",
        label: "Account number",
        name: "lastFourDigits",
        required: true,
        type: "text",
      },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Currency", name: "currency", required: true, type: "text" },
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
      { label: "Contact at institution", name: "institutionContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
