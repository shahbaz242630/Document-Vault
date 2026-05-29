import type { KeyboardTypeOptions } from "react-native";

import type { BankAccountFormValues } from "./bank-account-form";

type BankAccountFieldName = keyof BankAccountFormValues;

type BankAccountFieldOption = {
  label: string;
  value: string;
};

type BankAccountTextField = {
  helperText?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  name: BankAccountFieldName;
  required: boolean;
  type: "text";
};

type BankAccountSelectField = {
  helperText?: string;
  label: string;
  name: BankAccountFieldName;
  options: BankAccountFieldOption[];
  required: boolean;
  type: "select";
};

type BankAccountFormField = BankAccountTextField | BankAccountSelectField;

export type BankAccountFormViewModel = {
  fields: BankAccountFormField[];
};

export function createBankAccountFormViewModel(): BankAccountFormViewModel {
  return {
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Institution name", name: "institutionName", required: true, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Currency", name: "currency", required: true, type: "text" },
      {
        helperText: "We never ask for full account numbers.",
        keyboardType: "numeric",
        label: "Last 4 digits only",
        name: "lastFourDigits",
        required: true,
        type: "text",
      },
      {
        label: "Approximate value range",
        name: "approximateValueRange",
        options: [
          { label: "Under 50k", value: "under_50k" },
          { label: "50k to 200k", value: "50_200k" },
          { label: "200k to 500k", value: "200_500k" },
          { label: "500k to 1m", value: "500k_1m" },
          { label: "Over 1m", value: "over_1m" },
          { label: "Prefer not to say", value: "prefer_not_to_say" },
        ],
        required: true,
        type: "select",
      },
      { label: "Where documents are kept", name: "documentLocation", required: false, type: "text" },
      { label: "Contact at institution", name: "institutionContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
  };
}
