import { describe, expect, it } from "vitest";

import { formatAssetType, formatRecordSummary } from "./record-formatters";

describe("owner vault record formatters", () => {
  it("summarizes the complete pension context", () => {
    expect(formatRecordSummary({
      assetType: "pension",
      fields: {
        approximateValueRange: "200_500k",
        country: "UK",
        lastFourDigits: "1234",
        pensionProvider: "Example Pension",
      },
      title: "Workplace pension",
    })).toBe("Example Pension · ending 1234 · UK · 200k to 500k");
  });

  it("retains existing and fallback category labels", () => {
    expect(formatAssetType("pension")).toBe("Pension");
    expect(formatAssetType("crypto")).toBe("Crypto wallet");
    expect(formatAssetType("future_type")).toBe("Vault record");
  });

  it("summarizes subscription service, type, country, and monthly cost", () => {
    expect(formatRecordSummary({
      assetType: "subscription",
      fields: {
        approximateCostRange: "50_200",
        country: "UAE",
        serviceName: "Example Streaming",
        subscriptionType: "streaming",
      },
      title: "Family plan",
    })).toBe("Example Streaming · Streaming · UAE · 50 to 200 monthly");
  });

  it("summarizes document type, location, custodian, and country", () => {
    expect(formatRecordSummary({
      assetType: "document_location",
      fields: {
        country: "UAE",
        custodian: "Lawyer name",
        documentType: "will",
        location: "Home safe",
      },
      title: "Family will",
    })).toBe("Will · Home safe · Lawyer name · UAE");
  });

  it("summarizes contact relationship and details", () => {
    expect(formatRecordSummary({
      assetType: "contact",
      fields: {
        country: "UAE",
        email: "contact@example.com",
        name: "John Doe",
        phone: "+971501234567",
        relationship: "lawyer",
      },
      title: "John Doe",
    })).toBe("Lawyer · +971501234567 · contact@example.com · UAE");
    expect(formatAssetType("contact")).toBe("Contact");
  });

  it("summarizes vehicle type, make, registration, and country", () => {
    expect(formatRecordSummary({
      assetType: "vehicle",
      fields: {
        country: "UAE",
        makeModel: "Toyota Land Cruiser",
        registrationPlate: "A 12345",
        vehicleType: "SUV",
      },
      title: "Family SUV",
    })).toBe("SUV · Toyota Land Cruiser · A 12345 · UAE");
    expect(formatAssetType("vehicle")).toBe("Vehicle");
  });

  it("summarizes loan/debt lender, type, short reference, and country", () => {
    expect(formatRecordSummary({
      assetType: "loan_debt",
      fields: {
        country: "UAE",
        debtType: "Mortgage",
        lastFourDigits: "1234",
        lenderName: "Example Lender",
      },
      title: "Home loan",
    })).toBe("Example Lender · Mortgage · reference 1234 · UAE");
    expect(formatAssetType("loan_debt")).toBe("Loan or debt");
  });

  it("summarizes medical-care providers without expanding sensitive details", () => {
    expect(formatRecordSummary({
      assetType: "medical_care",
      fields: {
        conditions: "Sensitive condition",
        doctorOrClinic: "Example Clinic",
        healthInsurance: "Example Health",
        medications: "Sensitive medication",
      },
      title: "Primary medical care",
    })).toBe("Example Clinic · Example Health");
    expect(formatAssetType("medical_care")).toBe("Medical care");
  });

  it("summarizes dependent or pet care contacts without expanding care instructions", () => {
    expect(formatRecordSummary({
      assetType: "dependent_pet",
      fields: {
        careContact: "Example Vet",
        careInstructions: "Sensitive daily instructions",
        country: "UAE",
        name: "Milo",
        relationship: "Cat",
      },
      title: "Family pet",
    })).toBe("Milo · Cat · Example Vet · UAE");
    expect(formatAssetType("dependent_pet")).toBe("Dependent or pet");
  });
});
