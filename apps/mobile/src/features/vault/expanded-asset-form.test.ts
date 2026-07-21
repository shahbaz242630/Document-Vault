import { dependentPetVaultCategoryDefinition } from "@vault/shared-validation";
import { describe, expect, it } from "vitest";

import { getEditAssetConfig } from "./edit-asset-config";
import { createExpandedAssetPayload, getExpandedAssetConfig } from "./expanded-asset-form";

describe("createExpandedAssetPayload card contract", () => {
  it("uses the shared normalized card contract", () => {
    expect(createExpandedAssetPayload({
      assetType: "card",
      values: {
        cardType: " Credit ",
        country: " UAE ",
        issuerName: " Example Bank ",
        lastFourDigits: "1234",
        notes: " Family instructions ",
        supportContact: " Support desk ",
        title: " Main card ",
      },
    })).toEqual({
      assetType: "card",
      fields: {
        cardType: "Credit",
        country: "UAE",
        issuerName: "Example Bank",
        lastFourDigits: "1234",
        supportContact: "Support desk",
      },
      notes: "Family instructions",
      title: "Main card",
    });
  });

  it("rejects a value that is not exactly a four-digit suffix", () => {
    expect(() => createExpandedAssetPayload({
      assetType: "card",
      values: {
        country: "UAE",
        issuerName: "Example Bank",
        lastFourDigits: "4111111111111111",
        title: "Main card",
      },
    })).toThrow();
  });
});

describe("createExpandedAssetPayload vehicle contract", () => {
  it("uses the shared normalized vehicle contract", () => {
    expect(createExpandedAssetPayload({
      assetType: "vehicle",
      values: {
        country: " UAE ",
        documentLocation: " Home safe ",
        makeModel: " Toyota Land Cruiser ",
        notes: " Spare key with family ",
        registrationPlate: " A 12345 ",
        title: " Family SUV ",
        vehicleType: " SUV ",
      },
    })).toEqual({
      assetType: "vehicle",
      fields: {
        country: "UAE",
        documentLocation: "Home safe",
        makeModel: "Toyota Land Cruiser",
        registrationPlate: "A 12345",
        vehicleType: "SUV",
      },
      notes: "Spare key with family",
      title: "Family SUV",
    });
  });

  it("rejects a vehicle without its required make and model", () => {
    expect(() => createExpandedAssetPayload({
      assetType: "vehicle",
      values: {
        country: "UAE",
        makeModel: "",
        title: "Family SUV",
        vehicleType: "SUV",
      },
    })).toThrow();
  });
});

describe("createExpandedAssetPayload loan/debt contract", () => {
  it("uses the shared normalized loan/debt contract", () => {
    expect(createExpandedAssetPayload({
      assetType: "loan_debt",
      values: {
        contact: " Relationship manager ",
        country: " UAE ",
        debtType: " Mortgage ",
        lastFourDigits: " REF-1234 ",
        lenderName: " Example Lender ",
        notes: " Paid monthly ",
        title: " Home loan ",
      },
    })).toEqual({
      assetType: "loan_debt",
      fields: {
        contact: "Relationship manager",
        country: "UAE",
        debtType: "Mortgage",
        lastFourDigits: "REF-1234",
        lenderName: "Example Lender",
      },
      notes: "Paid monthly",
      title: "Home loan",
    });
  });

  it("rejects a loan/debt record without its lender", () => {
    expect(() => createExpandedAssetPayload({
      assetType: "loan_debt",
      values: {
        country: "UAE",
        debtType: "Mortgage",
        lenderName: "",
        title: "Home loan",
      },
    })).toThrow();
  });
});

describe("createExpandedAssetPayload medical-care contract", () => {
  it("uses the shared normalized medical-care contract", () => {
    expect(createExpandedAssetPayload({
      assetType: "medical_care",
      values: {
        conditions: " Penicillin allergy ",
        doctorOrClinic: " Example Clinic ",
        emergencyPreferences: " Contact family first ",
        healthInsurance: " Example Health ",
        medications: " Medication list location ",
        notes: " Review annually ",
        title: " Primary medical care ",
      },
    })).toEqual({
      assetType: "medical_care",
      fields: {
        conditions: "Penicillin allergy",
        doctorOrClinic: "Example Clinic",
        emergencyPreferences: "Contact family first",
        healthInsurance: "Example Health",
        medications: "Medication list location",
      },
      notes: "Review annually",
      title: "Primary medical care",
    });
  });

  it("rejects a medical-care record without a title", () => {
    expect(() => createExpandedAssetPayload({
      assetType: "medical_care",
      values: { title: "" },
    })).toThrow();
  });
});

describe("createExpandedAssetPayload dependent/pet registry contract", () => {
  it("derives the mobile form and normalized payload from the shared definition", () => {
    const config = getExpandedAssetConfig("dependent_pet");
    expect(config.categoryLabel).toBe(dependentPetVaultCategoryDefinition.categoryLabel);
    expect(config.fields.map(({ name }) => name)).toEqual(
      dependentPetVaultCategoryDefinition.fields.map(({ name }) => name),
    );

    expect(createExpandedAssetPayload({
      assetType: "dependent_pet",
      values: {
        careContact: " Example Vet ",
        careInstructions: " Medication at 8pm ",
        country: " UAE ",
        name: " Milo ",
        notes: " Call family first ",
        relationship: " Cat ",
        title: " Family pet ",
      },
    })).toEqual({
      assetType: "dependent_pet",
      fields: {
        careContact: "Example Vet",
        careInstructions: "Medication at 8pm",
        country: "UAE",
        name: "Milo",
        relationship: "Cat",
      },
      notes: "Call family first",
      title: "Family pet",
    });
  });

  it("rejects a dependent or pet record without its required name", () => {
    expect(() => createExpandedAssetPayload({
      assetType: "dependent_pet",
      values: { name: "", relationship: "Cat", title: "Family pet" },
    })).toThrow();
  });

  it("derives edit values from the same shared field roles", () => {
    const config = getEditAssetConfig("dependent_pet");

    expect(config.getInitialValues({
      assetType: "dependent_pet",
      fields: {
        careContact: "Example Vet",
        name: "Milo",
        relationship: "Cat",
      },
      id: "pet-1",
      notes: "Call family first",
      title: "Family pet",
    })).toMatchObject({
      careContact: "Example Vet",
      careInstructions: "",
      name: "Milo",
      notes: "Call family first",
      relationship: "Cat",
      title: "Family pet",
    });
  });

  it("preserves fields written by a newer client when editing", () => {
    const config = getEditAssetConfig("dependent_pet");

    expect(config.createPayload({
      careContact: "",
      careInstructions: "Updated instructions",
      country: "UAE",
      name: "Milo",
      notes: "",
      relationship: "Cat",
      title: "Family pet",
    }, {
      careContact: "Old contact",
      futureCarePlanVersion: "v2",
      name: "Old name",
      relationship: "Cat",
    })).toEqual({
      assetType: "dependent_pet",
      fields: {
        careInstructions: "Updated instructions",
        country: "UAE",
        futureCarePlanVersion: "v2",
        name: "Milo",
        relationship: "Cat",
      },
      notes: undefined,
      title: "Family pet",
    });
  });
});

describe("remaining expanded registry contracts", () => {
  it("normalizes a business-interest payload through the shared registry", () => {
    expect(createExpandedAssetPayload({
      assetType: "business_interest",
      values: {
        companyName: " Example Trading ",
        contact: " Operations lead ",
        country: " UAE ",
        instructions: " Contact the board ",
        notes: " Family reference ",
        roleOrOwnership: " Shareholder ",
        title: " Family business ",
      },
    })).toEqual({
      assetType: "business_interest",
      fields: {
        companyName: "Example Trading",
        contact: "Operations lead",
        country: "UAE",
        instructions: "Contact the board",
        roleOrOwnership: "Shareholder",
      },
      notes: "Family reference",
      title: "Family business",
    });
  });

  it("normalizes a digital-account payload without accepting credentials", () => {
    expect(createExpandedAssetPayload({
      assetType: "digital_account",
      values: {
        accountType: " Social ",
        instructions: " Preserve memorial page ",
        legacyContact: " Family email ",
        notes: " No passwords stored ",
        passwordManagerName: " Example manager ",
        serviceName: " Example Network ",
        title: " Social account ",
      },
    })).toEqual({
      assetType: "digital_account",
      fields: {
        accountType: "Social",
        instructions: "Preserve memorial page",
        legacyContact: "Family email",
        passwordManagerName: "Example manager",
        serviceName: "Example Network",
      },
      notes: "No passwords stored",
      title: "Social account",
    });
  });
});
