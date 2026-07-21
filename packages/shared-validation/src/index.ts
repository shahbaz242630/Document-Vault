import { z } from "zod";

import { createVaultCategoryRegistry } from "./vault-category-registry";

export const lastFourDigitsSchema = z
  .string()
  .regex(/^\d{4}$/, "Enter exactly the last 4 digits.");

export const bankAccountValueRanges = [
  "under_50k",
  "50_200k",
  "200_500k",
  "500k_1m",
  "over_1m",
  "prefer_not_to_say",
] as const;

const requiredTrimmedTextSchema = z.string().trim().min(1);
const optionalTrimmedTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const bankAccountFormSchema = z.object({
  approximateValueRange: z.enum(bankAccountValueRanges),
  country: requiredTrimmedTextSchema,
  currency: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  institutionContact: optionalTrimmedTextSchema,
  institutionName: requiredTrimmedTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type BankAccountFormValues = z.input<typeof bankAccountFormSchema>;

const optionalLastFourDigitsSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || lastFourDigitsSchema.safeParse(value).success, {
    message: "Enter exactly the last 4 digits or leave this blank.",
  })
  .optional()
  .transform((value) => (value ? value : undefined));

export const cardFormSchema = z.object({
  cardType: optionalTrimmedTextSchema,
  country: requiredTrimmedTextSchema,
  issuerName: requiredTrimmedTextSchema,
  lastFourDigits: optionalLastFourDigitsSchema,
  notes: optionalTrimmedTextSchema,
  supportContact: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type CardFormValues = z.input<typeof cardFormSchema>;

export const investmentAccountTypes = [
  "brokerage",
  "retirement",
  "mutual_fund",
  "other",
] as const;

export const investmentFormSchema = z.object({
  accountType: z.enum(investmentAccountTypes),
  approximateValueRange: z.enum(bankAccountValueRanges),
  country: requiredTrimmedTextSchema,
  currency: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  institutionContact: optionalTrimmedTextSchema,
  institutionName: requiredTrimmedTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type InvestmentFormValues = z.input<typeof investmentFormSchema>;

export const propertyFormSchema = z.object({
  address: requiredTrimmedTextSchema,
  approximateValueRange: z.enum(bankAccountValueRanges),
  contact: optionalTrimmedTextSchema,
  country: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  mortgageProvider: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type PropertyFormValues = z.input<typeof propertyFormSchema>;

export const insurancePolicyTypes = [
  "life",
  "health",
  "property",
  "auto",
  "other",
] as const;

export const insuranceFormSchema = z.object({
  approximateValueRange: z.enum(bankAccountValueRanges),
  country: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  insuranceContact: optionalTrimmedTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTrimmedTextSchema,
  policyType: z.enum(insurancePolicyTypes),
  providerName: requiredTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type InsuranceFormValues = z.input<typeof insuranceFormSchema>;

export const cryptoTypes = ["bitcoin", "ethereum", "other"] as const;

const walletIdentifierSchema = requiredTrimmedTextSchema.max(
  16,
  "Enter a short label or only the last 4 wallet characters, not a complete address.",
);

export const cryptoFormSchema = z.object({
  approximateValueRange: z.enum(bankAccountValueRanges),
  country: requiredTrimmedTextSchema,
  cryptoType: z.enum(cryptoTypes),
  documentLocation: optionalTrimmedTextSchema,
  exchangeName: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
  walletIdentifier: walletIdentifierSchema,
});

export type CryptoFormValues = z.input<typeof cryptoFormSchema>;

export const pensionFormSchema = z.object({
  approximateValueRange: z.enum(bankAccountValueRanges),
  country: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTrimmedTextSchema,
  pensionContact: optionalTrimmedTextSchema,
  pensionProvider: requiredTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type PensionFormValues = z.input<typeof pensionFormSchema>;

export const subscriptionCostRanges = [
  "under_50",
  "50_200",
  "200_500",
  "over_500",
  "prefer_not_to_say",
] as const;

export const subscriptionTypes = ["streaming", "software", "utility", "other"] as const;

export const subscriptionFormSchema = z.object({
  approximateCostRange: z.enum(subscriptionCostRanges),
  country: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  serviceName: requiredTrimmedTextSchema,
  subscriptionContact: optionalTrimmedTextSchema,
  subscriptionType: z.enum(subscriptionTypes),
  title: requiredTrimmedTextSchema,
});

export type SubscriptionFormValues = z.input<typeof subscriptionFormSchema>;

export const documentTypes = ["will", "deed", "passport", "other"] as const;

export const documentLocationFormSchema = z.object({
  country: requiredTrimmedTextSchema,
  custodian: optionalTrimmedTextSchema,
  documentType: z.enum(documentTypes),
  location: requiredTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type DocumentLocationFormValues = z.input<typeof documentLocationFormSchema>;

export const contactRelationships = [
  "lawyer",
  "accountant",
  "employer",
  "embassy",
  "other",
] as const;

export const contactFormSchema = z.object({
  country: requiredTrimmedTextSchema,
  email: optionalTrimmedTextSchema,
  name: requiredTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  phone: optionalTrimmedTextSchema,
  relationship: z.enum(contactRelationships),
});

export type ContactFormValues = z.input<typeof contactFormSchema>;

export const vehicleFormSchema = z.object({
  country: requiredTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  makeModel: requiredTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  registrationPlate: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
  vehicleType: requiredTrimmedTextSchema,
});

export type VehicleFormValues = z.input<typeof vehicleFormSchema>;

export const loanDebtFormSchema = z.object({
  contact: optionalTrimmedTextSchema,
  country: requiredTrimmedTextSchema,
  debtType: requiredTrimmedTextSchema,
  lastFourDigits: optionalTrimmedTextSchema,
  lenderName: requiredTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type LoanDebtFormValues = z.input<typeof loanDebtFormSchema>;

export const medicalCareFormSchema = z.object({
  conditions: optionalTrimmedTextSchema,
  doctorOrClinic: optionalTrimmedTextSchema,
  emergencyPreferences: optionalTrimmedTextSchema,
  healthInsurance: optionalTrimmedTextSchema,
  medications: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type MedicalCareFormValues = z.input<typeof medicalCareFormSchema>;

export const dependentPetFormSchema = z.object({
  careContact: optionalTrimmedTextSchema,
  careInstructions: optionalTrimmedTextSchema,
  country: optionalTrimmedTextSchema,
  name: requiredTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  relationship: requiredTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type DependentPetFormValues = z.input<typeof dependentPetFormSchema>;

export const businessInterestFormSchema = z.object({
  companyName: requiredTrimmedTextSchema,
  contact: optionalTrimmedTextSchema,
  country: requiredTrimmedTextSchema,
  instructions: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  roleOrOwnership: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export const digitalAccountFormSchema = z.object({
  accountType: optionalTrimmedTextSchema,
  instructions: optionalTrimmedTextSchema,
  legacyContact: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  passwordManagerName: optionalTrimmedTextSchema,
  serviceName: requiredTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export const otherFormSchema = z.object({
  approximateValue: optionalTrimmedTextSchema,
  category: optionalTrimmedTextSchema,
  country: requiredTrimmedTextSchema,
  description: optionalTrimmedTextSchema,
  documentLocation: optionalTrimmedTextSchema,
  notes: optionalTrimmedTextSchema,
  title: requiredTrimmedTextSchema,
});

export type BusinessInterestFormValues = z.input<typeof businessInterestFormSchema>;
export type DigitalAccountFormValues = z.input<typeof digitalAccountFormSchema>;
export type OtherFormValues = z.input<typeof otherFormSchema>;

export type {
  SchemaDrivenVaultCategoryDefinition,
  SchemaDrivenVaultPayload,
  VaultCategoryFieldDefinition,
} from "./vault-category-registry";

const vaultCategoryRegistry = createVaultCategoryRegistry({
  bank_account: bankAccountFormSchema,
  business_interest: businessInterestFormSchema,
  card: cardFormSchema,
  contact: contactFormSchema,
  crypto: cryptoFormSchema,
  dependent_pet: dependentPetFormSchema,
  digital_account: digitalAccountFormSchema,
  document_location: documentLocationFormSchema,
  insurance: insuranceFormSchema,
  investment: investmentFormSchema,
  loan_debt: loanDebtFormSchema,
  medical_care: medicalCareFormSchema,
  other: otherFormSchema,
  pension: pensionFormSchema,
  property: propertyFormSchema,
  subscription: subscriptionFormSchema,
  vehicle: vehicleFormSchema,
});

export const schemaDrivenVaultCategories = vaultCategoryRegistry.categories;
export const getSchemaDrivenVaultCategory = vaultCategoryRegistry.getCategory;
export const createSchemaDrivenVaultInitialValues = vaultCategoryRegistry.createInitialValues;
export const createSchemaDrivenVaultPayload = vaultCategoryRegistry.createPayload;
export const formatSchemaDrivenVaultSummary = vaultCategoryRegistry.formatSummary;
export const bankAccountVaultCategoryDefinition = vaultCategoryRegistry.byAssetType.bank_account;
export const contactVaultCategoryDefinition = vaultCategoryRegistry.byAssetType.contact;
export const dependentPetVaultCategoryDefinition = vaultCategoryRegistry.byAssetType.dependent_pet;
