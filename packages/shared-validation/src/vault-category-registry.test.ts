import { assetTypes } from "@vault/shared-types";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  contactVaultCategoryDefinition,
  createSchemaDrivenVaultInitialValues,
  createSchemaDrivenVaultPayload,
  dependentPetVaultCategoryDefinition,
  formatSchemaDrivenVaultSummary,
  getSchemaDrivenVaultCategory,
  schemaDrivenVaultCategories,
} from "./index";

describe("schema-driven vault category registry", () => {
  it("enforces safe structural invariants for every registered category", () => {
    const registeredAssetTypes = schemaDrivenVaultCategories.map(({ assetType }) => assetType);
    expect(new Set(registeredAssetTypes).size).toBe(registeredAssetTypes.length);
    expect(new Set(registeredAssetTypes)).toEqual(new Set(assetTypes));

    for (const definition of schemaDrivenVaultCategories) {
      expect(definition.version).toBeGreaterThan(0);
      expect(definition.securityClass).toBe("encrypted_payload_only");
      expect(definition.fields.filter(({ role }) =>
        role === "title" || role === "title_and_payload",
      )).toHaveLength(1);
      expect(definition.fields.filter(({ role }) => role === "notes").length).toBeLessThanOrEqual(1);
      expect(new Set(definition.fields.map(({ name }) => name)).size).toBe(definition.fields.length);
      expect(definition.schema).toBeInstanceOf(z.ZodObject);
      expect(new Set(definition.fields.map(({ name }) => name))).toEqual(
        new Set(Object.keys((definition.schema as z.ZodObject).shape)),
      );
      for (const field of definition.fields.filter(({ control }) => control === "select")) {
        expect(field.options?.some(({ value }) => value === field.defaultValue)).toBe(true);
      }
      expect(definition.summaryFields.every((name) =>
        definition.fields.some((field) => field.name === name && field.role === "payload"),
      )).toBe(true);
    }
  });

  it("preserves the existing dependent or pet payload contract", () => {
    expect(createSchemaDrivenVaultPayload(dependentPetVaultCategoryDefinition, {
      careContact: " Example Vet ",
      careInstructions: " Medication at 8pm ",
      country: " UAE ",
      name: " Milo ",
      notes: " Call family first ",
      relationship: " Cat ",
      title: " Family pet ",
    }, {
      futureMobileField: "must survive",
      title: "legacy duplicated title",
    })).toEqual({
      assetType: "dependent_pet",
      fields: {
        careContact: "Example Vet",
        careInstructions: "Medication at 8pm",
        country: "UAE",
        futureMobileField: "must survive",
        name: "Milo",
        relationship: "Cat",
      },
      notes: "Call family first",
      title: "Family pet",
    });
  });

  it("creates normalized ciphertext-boundary payloads and preserves future fields", () => {
    const payload = createSchemaDrivenVaultPayload(contactVaultCategoryDefinition, {
      country: " UAE ",
      email: " ",
      name: " John Doe ",
      notes: " Family lawyer ",
      phone: " +971501234567 ",
      relationship: "lawyer",
    }, {
      email: "old@example.com",
      futureMobileField: "must survive",
    });

    expect(payload).toEqual({
      assetType: "contact",
      fields: {
        country: "UAE",
        futureMobileField: "must survive",
        name: "John Doe",
        phone: "+971501234567",
        relationship: "lawyer",
      },
      notes: "Family lawyer",
      title: "John Doe",
    });
  });

  it("derives add/edit values and summaries from the same definition", () => {
    expect(createSchemaDrivenVaultInitialValues(contactVaultCategoryDefinition)).toEqual({
      country: "",
      email: "",
      name: "",
      notes: "",
      phone: "",
      relationship: "lawyer",
    });
    expect(createSchemaDrivenVaultInitialValues(contactVaultCategoryDefinition, {
      fields: { country: "UAE", futureMobileField: "ignored", relationship: "lawyer" },
      notes: "Family lawyer",
      title: "John Doe",
    })).toMatchObject({
      country: "UAE",
      name: "John Doe",
      notes: "Family lawyer",
      relationship: "lawyer",
    });
    expect(formatSchemaDrivenVaultSummary(contactVaultCategoryDefinition, {
      country: "UAE",
      relationship: "lawyer",
    })).toBe("Lawyer · UAE");
    expect(getSchemaDrivenVaultCategory("contact")).toBe(contactVaultCategoryDefinition);
    expect(getSchemaDrivenVaultCategory("dependent_pet")).toBe(dependentPetVaultCategoryDefinition);
    expect(getSchemaDrivenVaultCategory("bank_account")?.assetType).toBe("bank_account");
    expect(getSchemaDrivenVaultCategory("not_a_category")).toBeUndefined();
  });
});
