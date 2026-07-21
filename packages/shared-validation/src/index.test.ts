import { describe, expect, it } from "vitest";

import {
  bankAccountFormSchema,
  cardFormSchema,
  contactFormSchema,
  cryptoFormSchema,
  documentLocationFormSchema,
  insuranceFormSchema,
  investmentFormSchema,
  lastFourDigitsSchema,
  loanDebtFormSchema,
  medicalCareFormSchema,
  pensionFormSchema,
  propertyFormSchema,
  subscriptionFormSchema,
  vehicleFormSchema,
} from "./index";

describe("lastFourDigitsSchema", () => {
  it("accepts exactly four ASCII digits", () => {
    expect(lastFourDigitsSchema.parse("0000")).toBe("0000");
    expect(lastFourDigitsSchema.parse("1234")).toBe("1234");
    expect(lastFourDigitsSchema.parse("9999")).toBe("9999");
  });

  it.each([
    ["too short", "123"],
    ["too long", "12345"],
    ["letters", "12a4"],
    ["leading whitespace", " 1234"],
    ["trailing whitespace", "1234 "],
    ["punctuation", "12-4"],
    ["non-ASCII digits", "١٢٣٤"],
    ["number value", 1234],
    ["null value", null],
  ])("rejects %s", (_label, value) => {
    expect(lastFourDigitsSchema.safeParse(value).success).toBe(false);
  });
});

describe("bankAccountFormSchema", () => {
  it("normalizes the complete mobile/web bank-account contract", () => {
    expect(bankAccountFormSchema.parse({
      approximateValueRange: "50_200k",
      country: " UAE ",
      currency: " AED ",
      documentLocation: " Home safe ",
      institutionContact: " Relationship manager ",
      institutionName: " Example Bank ",
      lastFourDigits: "1234",
      notes: " Family instructions ",
      title: " Main account ",
    })).toEqual({
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Relationship manager",
      institutionName: "Example Bank",
      lastFourDigits: "1234",
      notes: "Family instructions",
      title: "Main account",
    });
  });

  it("omits blank optional fields and rejects incomplete records", () => {
    const result = bankAccountFormSchema.parse({
      approximateValueRange: "prefer_not_to_say",
      country: "UAE",
      currency: "AED",
      documentLocation: " ",
      institutionContact: "",
      institutionName: "Example Bank",
      lastFourDigits: "1234",
      notes: " ",
      title: "Main account",
    });

    expect(result.documentLocation).toBeUndefined();
    expect(result.institutionContact).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(bankAccountFormSchema.safeParse({ ...result, country: "" }).success).toBe(false);
  });
});

describe("cardFormSchema", () => {
  it("normalizes the complete mobile/web card contract", () => {
    expect(cardFormSchema.parse({
      cardType: " Credit ",
      country: " UAE ",
      issuerName: " Example Bank ",
      lastFourDigits: "1234",
      notes: " Family instructions ",
      supportContact: " +971 00 000 0000 ",
      title: " Main card ",
    })).toEqual({
      cardType: "Credit",
      country: "UAE",
      issuerName: "Example Bank",
      lastFourDigits: "1234",
      notes: "Family instructions",
      supportContact: "+971 00 000 0000",
      title: "Main card",
    });
  });

  it("allows a blank suffix but rejects partial or full card numbers", () => {
    expect(cardFormSchema.parse({
      cardType: "",
      country: "UAE",
      issuerName: "Example Bank",
      lastFourDigits: "",
      notes: "",
      supportContact: "",
      title: "Main card",
    }).lastFourDigits).toBeUndefined();
    expect(cardFormSchema.safeParse({
      country: "UAE",
      issuerName: "Example Bank",
      lastFourDigits: "123",
      title: "Main card",
    }).success).toBe(false);
    expect(cardFormSchema.safeParse({
      country: "UAE",
      issuerName: "Example Bank",
      lastFourDigits: "4111111111111111",
      title: "Main card",
    }).success).toBe(false);
  });
});

describe("investmentFormSchema", () => {
  const completeInvestment = {
    accountType: "brokerage",
    approximateValueRange: "50_200k",
    country: " UAE ",
    currency: " AED ",
    documentLocation: " Home safe ",
    institutionContact: " Advisor ",
    institutionName: " Example Broker ",
    lastFourDigits: "1234",
    notes: " Family instructions ",
    title: " Primary investment ",
  } as const;

  it("normalizes the complete mobile/web investment contract", () => {
    expect(investmentFormSchema.parse(completeInvestment)).toEqual({
      accountType: "brokerage",
      approximateValueRange: "50_200k",
      country: "UAE",
      currency: "AED",
      documentLocation: "Home safe",
      institutionContact: "Advisor",
      institutionName: "Example Broker",
      lastFourDigits: "1234",
      notes: "Family instructions",
      title: "Primary investment",
    });
  });

  it("rejects unsupported account types and full account numbers", () => {
    expect(investmentFormSchema.safeParse({
      ...completeInvestment,
      accountType: "checking",
    }).success).toBe(false);
    expect(investmentFormSchema.safeParse({
      ...completeInvestment,
      lastFourDigits: "123456789",
    }).success).toBe(false);
  });
});

describe("propertyFormSchema", () => {
  const completeProperty = {
    address: " 123 Palm Jumeirah ",
    approximateValueRange: "500k_1m",
    contact: " Property manager ",
    country: " UAE ",
    documentLocation: " Home safe ",
    mortgageProvider: " Example Mortgage ",
    notes: " Joint ownership ",
    title: " Dubai apartment ",
  } as const;

  it("normalizes the complete mobile/web property contract", () => {
    expect(propertyFormSchema.parse(completeProperty)).toEqual({
      address: "123 Palm Jumeirah",
      approximateValueRange: "500k_1m",
      contact: "Property manager",
      country: "UAE",
      documentLocation: "Home safe",
      mortgageProvider: "Example Mortgage",
      notes: "Joint ownership",
      title: "Dubai apartment",
    });
  });

  it("omits blank optional fields and rejects missing required fields", () => {
    const result = propertyFormSchema.parse({
      ...completeProperty,
      contact: "",
      documentLocation: " ",
      mortgageProvider: "",
      notes: " ",
    });
    expect(result.contact).toBeUndefined();
    expect(result.documentLocation).toBeUndefined();
    expect(result.mortgageProvider).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(propertyFormSchema.safeParse({ ...completeProperty, address: "" }).success).toBe(false);
  });
});

describe("insuranceFormSchema", () => {
  const completeInsurance = {
    approximateValueRange: "200_500k",
    country: " UAE ",
    documentLocation: " Home safe ",
    insuranceContact: " Agent ",
    lastFourDigits: "1234",
    notes: " Review annually ",
    policyType: "life",
    providerName: " Example Insurance ",
    title: " Life policy ",
  } as const;

  it("normalizes the complete mobile/web insurance contract", () => {
    expect(insuranceFormSchema.parse(completeInsurance)).toEqual({
      approximateValueRange: "200_500k",
      country: "UAE",
      documentLocation: "Home safe",
      insuranceContact: "Agent",
      lastFourDigits: "1234",
      notes: "Review annually",
      policyType: "life",
      providerName: "Example Insurance",
      title: "Life policy",
    });
  });

  it("rejects unsupported policy types and full policy numbers", () => {
    expect(insuranceFormSchema.safeParse({
      ...completeInsurance,
      policyType: "travel",
    }).success).toBe(false);
    expect(insuranceFormSchema.safeParse({
      ...completeInsurance,
      lastFourDigits: "123456789",
    }).success).toBe(false);
  });
});

describe("cryptoFormSchema", () => {
  const completeCrypto = {
    approximateValueRange: "under_50k",
    country: " UAE ",
    cryptoType: "bitcoin",
    documentLocation: " Hardware wallet in safe ",
    exchangeName: " Example Exchange ",
    notes: " Recovery material is in a safety deposit box ",
    title: " Bitcoin wallet ",
    walletIdentifier: " BTC cold ",
  } as const;

  it("normalizes the complete mobile/web crypto-reference contract", () => {
    expect(cryptoFormSchema.parse(completeCrypto)).toEqual({
      approximateValueRange: "under_50k",
      country: "UAE",
      cryptoType: "bitcoin",
      documentLocation: "Hardware wallet in safe",
      exchangeName: "Example Exchange",
      notes: "Recovery material is in a safety deposit box",
      title: "Bitcoin wallet",
      walletIdentifier: "BTC cold",
    });
  });

  it("rejects unsupported crypto types and complete wallet addresses", () => {
    expect(cryptoFormSchema.safeParse({
      ...completeCrypto,
      cryptoType: "solana",
    }).success).toBe(false);
    expect(cryptoFormSchema.safeParse({
      ...completeCrypto,
      walletIdentifier: "0x52908400098527886E0F7030069857D2E4169EE7",
    }).success).toBe(false);
  });
});

describe("pensionFormSchema", () => {
  const completePension = {
    approximateValueRange: "200_500k",
    country: " UK ",
    documentLocation: " Home safe ",
    lastFourDigits: "1234",
    notes: " Company matched contributions ",
    pensionContact: " HR department ",
    pensionProvider: " Example Pension ",
    title: " Workplace pension ",
  } as const;

  it("normalizes the complete mobile/web pension contract", () => {
    expect(pensionFormSchema.parse(completePension)).toEqual({
      approximateValueRange: "200_500k",
      country: "UK",
      documentLocation: "Home safe",
      lastFourDigits: "1234",
      notes: "Company matched contributions",
      pensionContact: "HR department",
      pensionProvider: "Example Pension",
      title: "Workplace pension",
    });
  });

  it("omits blank optional fields and rejects full account numbers", () => {
    const result = pensionFormSchema.parse({
      ...completePension,
      documentLocation: "",
      notes: " ",
      pensionContact: "",
    });
    expect(result.documentLocation).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.pensionContact).toBeUndefined();
    expect(pensionFormSchema.safeParse({
      ...completePension,
      lastFourDigits: "123456789",
    }).success).toBe(false);
  });
});

describe("subscriptionFormSchema", () => {
  const completeSubscription = {
    approximateCostRange: "50_200",
    country: " UAE ",
    documentLocation: " Email inbox ",
    notes: " Annual billing cycle ",
    serviceName: " Example Streaming ",
    subscriptionContact: " Support ",
    subscriptionType: "streaming",
    title: " Family plan ",
  } as const;

  it("normalizes the complete mobile/web subscription contract", () => {
    expect(subscriptionFormSchema.parse(completeSubscription)).toEqual({
      approximateCostRange: "50_200",
      country: "UAE",
      documentLocation: "Email inbox",
      notes: "Annual billing cycle",
      serviceName: "Example Streaming",
      subscriptionContact: "Support",
      subscriptionType: "streaming",
      title: "Family plan",
    });
  });

  it("omits blank optional fields and rejects unsupported subscription types", () => {
    const result = subscriptionFormSchema.parse({
      ...completeSubscription,
      documentLocation: "",
      notes: " ",
      subscriptionContact: "",
    });
    expect(result.documentLocation).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.subscriptionContact).toBeUndefined();
    expect(subscriptionFormSchema.safeParse({
      ...completeSubscription,
      subscriptionType: "membership",
    }).success).toBe(false);
  });
});

describe("documentLocationFormSchema", () => {
  const completeDocument = {
    country: " UAE ",
    custodian: " Lawyer name ",
    documentType: "will",
    location: " Home safe, bedroom closet ",
    notes: " Original plus two copies ",
    title: " Family will ",
  } as const;

  it("normalizes the complete mobile/web document-location contract", () => {
    expect(documentLocationFormSchema.parse(completeDocument)).toEqual({
      country: "UAE",
      custodian: "Lawyer name",
      documentType: "will",
      location: "Home safe, bedroom closet",
      notes: "Original plus two copies",
      title: "Family will",
    });
  });

  it("omits blank optional fields and rejects unsupported document types", () => {
    const result = documentLocationFormSchema.parse({
      ...completeDocument,
      custodian: "",
      notes: " ",
    });
    expect(result.custodian).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(documentLocationFormSchema.safeParse({
      ...completeDocument,
      documentType: "birth_certificate",
    }).success).toBe(false);
  });
});

describe("contactFormSchema", () => {
  const completeContact = {
    country: " UAE ",
    email: " contact@example.com ",
    name: " John Doe ",
    notes: " Primary family lawyer. ",
    phone: " +971501234567 ",
    relationship: "lawyer",
  } as const;

  it("normalizes the complete mobile/web contact contract", () => {
    expect(contactFormSchema.parse(completeContact)).toEqual({
      country: "UAE",
      email: "contact@example.com",
      name: "John Doe",
      notes: "Primary family lawyer.",
      phone: "+971501234567",
      relationship: "lawyer",
    });
  });

  it("omits blank optional fields and rejects unsupported relationships", () => {
    const result = contactFormSchema.parse({
      ...completeContact,
      email: "",
      notes: " ",
      phone: "",
    });
    expect(result.email).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.phone).toBeUndefined();
    expect(contactFormSchema.safeParse({
      ...completeContact,
      relationship: "beneficiary",
    }).success).toBe(false);
  });
});

describe("vehicleFormSchema", () => {
  const completeVehicle = {
    country: " UAE ",
    documentLocation: " Home safe ",
    makeModel: " Toyota Land Cruiser ",
    notes: " Spare key with family ",
    registrationPlate: " A 12345 ",
    title: " Family SUV ",
    vehicleType: " SUV ",
  };

  it("normalizes the complete mobile/web vehicle contract", () => {
    expect(vehicleFormSchema.parse(completeVehicle)).toEqual({
      country: "UAE",
      documentLocation: "Home safe",
      makeModel: "Toyota Land Cruiser",
      notes: "Spare key with family",
      registrationPlate: "A 12345",
      title: "Family SUV",
      vehicleType: "SUV",
    });
  });

  it("omits blank optional fields and rejects missing required fields", () => {
    const result = vehicleFormSchema.parse({
      ...completeVehicle,
      documentLocation: "",
      notes: " ",
      registrationPlate: "",
    });
    expect(result.documentLocation).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(result.registrationPlate).toBeUndefined();
    expect(vehicleFormSchema.safeParse({ ...completeVehicle, makeModel: "" }).success).toBe(false);
  });
});

describe("loanDebtFormSchema", () => {
  const completeLoanDebt = {
    contact: " Relationship manager ",
    country: " UAE ",
    debtType: " Mortgage ",
    lastFourDigits: " REF-1234 ",
    lenderName: " Example Lender ",
    notes: " Paid monthly ",
    title: " Home loan ",
  };

  it("normalizes the complete mobile/web loan-debt contract", () => {
    expect(loanDebtFormSchema.parse(completeLoanDebt)).toEqual({
      contact: "Relationship manager",
      country: "UAE",
      debtType: "Mortgage",
      lastFourDigits: "REF-1234",
      lenderName: "Example Lender",
      notes: "Paid monthly",
      title: "Home loan",
    });
  });

  it("omits blank optional fields and rejects missing required fields", () => {
    const result = loanDebtFormSchema.parse({
      ...completeLoanDebt,
      contact: "",
      lastFourDigits: " ",
      notes: "",
    });
    expect(result.contact).toBeUndefined();
    expect(result.lastFourDigits).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(loanDebtFormSchema.safeParse({ ...completeLoanDebt, lenderName: "" }).success).toBe(false);
  });
});

describe("medicalCareFormSchema", () => {
  const completeMedicalCare = {
    conditions: " Penicillin allergy ",
    doctorOrClinic: " Example Clinic ",
    emergencyPreferences: " Contact family first ",
    healthInsurance: " Example Health ",
    medications: " Medication list location ",
    notes: " Review annually ",
    title: " Primary medical care ",
  };

  it("normalizes the complete mobile/web medical-care contract", () => {
    expect(medicalCareFormSchema.parse(completeMedicalCare)).toEqual({
      conditions: "Penicillin allergy",
      doctorOrClinic: "Example Clinic",
      emergencyPreferences: "Contact family first",
      healthInsurance: "Example Health",
      medications: "Medication list location",
      notes: "Review annually",
      title: "Primary medical care",
    });
  });

  it("omits blank optional fields and rejects a missing title", () => {
    const result = medicalCareFormSchema.parse({
      ...completeMedicalCare,
      conditions: "",
      doctorOrClinic: " ",
      medications: "",
      notes: " ",
    });
    expect(result.conditions).toBeUndefined();
    expect(result.doctorOrClinic).toBeUndefined();
    expect(result.medications).toBeUndefined();
    expect(result.notes).toBeUndefined();
    expect(medicalCareFormSchema.safeParse({ ...completeMedicalCare, title: "" }).success).toBe(false);
  });
});
