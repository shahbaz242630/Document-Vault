import { contactVaultCategoryDefinition } from "@vault/shared-validation";
import { describe, expect, it } from "vitest";

import { createContactFormViewModel } from "./contact-form-view-model";

describe("createContactFormViewModel", () => {
  it("derives mobile fields and defaults from the shared category definition", () => {
    const viewModel = createContactFormViewModel();

    expect(viewModel.categoryLabel).toBe(contactVaultCategoryDefinition.categoryLabel);
    expect(viewModel.fields.map(({ name }) => name)).toEqual(
      contactVaultCategoryDefinition.fields.map(({ name }) => name),
    );
    expect(viewModel.initialValues).toEqual(Object.fromEntries(
      contactVaultCategoryDefinition.fields.map((field) => [field.name, field.defaultValue]),
    ));
  });

  it("maps platform-neutral input hints to mobile keyboards", () => {
    const fields = createContactFormViewModel().fields;

    expect(fields.find(({ name }) => name === "email")).toMatchObject({ keyboardType: "email-address" });
    expect(fields.find(({ name }) => name === "phone")).toMatchObject({ keyboardType: "phone-pad" });
  });
});
