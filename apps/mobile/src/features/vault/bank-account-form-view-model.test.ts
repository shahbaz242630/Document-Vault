import { describe, expect, it } from "vitest";

import { createBankAccountFormViewModel } from "./bank-account-form-view-model";

describe("createBankAccountFormViewModel", () => {
  it("returns ordered fields for the first bank account form", () => {
    const viewModel = createBankAccountFormViewModel();

    expect(viewModel.fields.map((field) => field.name)).toEqual([
      "title",
      "institutionName",
      "country",
      "currency",
      "lastFourDigits",
      "approximateValueRange",
      "documentLocation",
      "institutionContact",
      "notes",
    ]);
  });

  it("uses safe copy for last-4 collection", () => {
    const viewModel = createBankAccountFormViewModel();
    const lastFourField = viewModel.fields.find((field) => field.name === "lastFourDigits");

    expect(lastFourField).toEqual({
      helperText: "We never ask for full account numbers.",
      keyboardType: "numeric",
      label: "Last 4 digits only",
      name: "lastFourDigits",
      required: true,
      type: "text",
    });
  });

  it("uses fixed options for approximate value range", () => {
    const viewModel = createBankAccountFormViewModel();
    const valueRangeField = viewModel.fields.find(
      (field) => field.name === "approximateValueRange",
    );

    expect(valueRangeField).toEqual({
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
    });
  });
});
