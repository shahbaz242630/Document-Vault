import { assetTypes, type AssetType } from "@vault/shared-types";
import type { ZodType } from "zod";

export type VaultCategoryFieldDefinition = {
  control: "select" | "text" | "textarea";
  defaultValue: string;
  helperText?: string;
  label: string;
  maxLength?: number;
  name: string;
  options?: readonly { label: string; summaryLabel?: string; value: string }[];
  pattern?: string;
  required: boolean;
  role: "notes" | "payload" | "title" | "title_and_payload";
  summaryPrefix?: string;
  textInputMode?: "email" | "numeric" | "tel" | "text";
};

export type SchemaDrivenVaultCategoryDefinition = {
  assetType: AssetType;
  categoryLabel: string;
  fields: readonly VaultCategoryFieldDefinition[];
  pluralLabel: string;
  schema: ZodType;
  securityClass: "encrypted_payload_only";
  summaryFields: readonly string[];
  version: number;
};

export type SchemaDrivenVaultPayload = {
  assetType: AssetType;
  fields: Record<string, string>;
  notes?: string;
  title: string;
};

type VaultCategorySchemas = Record<AssetType, ZodType>;

const valueRangeOptions = [
  { label: "Under 50k", value: "under_50k" },
  { label: "50k to 200k", value: "50_200k" },
  { label: "200k to 500k", value: "200_500k" },
  { label: "500k to 1m", value: "500k_1m" },
  { label: "Over 1m", value: "over_1m" },
  { label: "Prefer not to say", summaryLabel: "Value not stated", value: "prefer_not_to_say" },
] as const;

function createFinancialCategories(schemas: VaultCategorySchemas) {
  return [
    category("bank_account", "Bank account", "Bank accounts", schemas, [
      title("Reference title"), text("institutionName", "Institution name", true), text("country", "Country", true),
      text("currency", "Currency", true), lastFour("We never ask for full account numbers."),
      select("approximateValueRange", "Approximate value range", "prefer_not_to_say", valueRangeOptions),
      text("documentLocation", "Where documents are kept"), text("institutionContact", "Contact at institution"), notes(),
    ], ["institutionName", "lastFourDigits", "country", "currency", "approximateValueRange"]),
    category("card", "Card", "Cards", schemas, [
      title("Reference title"), text("issuerName", "Issuer or bank", true), text("cardType", "Card type"),
      text("country", "Country", true), optionalLastFour("Store only the last 4 digits."),
      text("supportContact", "Support phone or website"), notes(),
    ], ["issuerName", "cardType", "lastFourDigits", "country"]),
    category("investment", "Investment", "Investments", schemas, [
      title(), text("institutionName", "Institution name", true),
      select("accountType", "Account type", "brokerage", [
        { label: "Brokerage", value: "brokerage" }, { label: "Retirement", value: "retirement" },
        { label: "Mutual fund", value: "mutual_fund" }, { label: "Other", summaryLabel: "Other investment", value: "other" },
      ]), lastFour("Only the last 4 digits."), text("country", "Country", true), text("currency", "Currency", true),
      select("approximateValueRange", "Approximate value", "prefer_not_to_say", valueRangeOptions),
      text("documentLocation", "Document location"), text("institutionContact", "Contact at institution"), notes(),
    ], ["institutionName", "accountType", "lastFourDigits", "country", "currency", "approximateValueRange"]),
    category("property", "Property", "Properties", schemas, [
      title(), text("address", "Address", true), text("country", "Country", true),
      select("approximateValueRange", "Approximate value", "prefer_not_to_say", valueRangeOptions),
      text("mortgageProvider", "Mortgage provider"), text("documentLocation", "Document location"),
      text("contact", "Contact"), notes(),
    ], ["address", "mortgageProvider", "country", "approximateValueRange"]),
    category("vehicle", "Vehicle", "Vehicles", schemas, [
      title("Reference title"), text("vehicleType", "Vehicle type", true), text("makeModel", "Make and model", true),
      text("registrationPlate", "Registration plate"), text("country", "Country or state", true),
      text("documentLocation", "Document or spare key location"), notes(),
    ], ["vehicleType", "makeModel", "registrationPlate", "country"]),
    category("insurance", "Insurance", "Insurance", schemas, [
      title(), text("providerName", "Provider name", true), select("policyType", "Policy type", "life", [
        { label: "Life", value: "life" }, { label: "Health", value: "health" }, { label: "Property", value: "property" },
        { label: "Auto", value: "auto" }, { label: "Other", summaryLabel: "Other policy", value: "other" },
      ]), lastFour("Only the last 4 digits of the policy number."), text("country", "Country", true),
      select("approximateValueRange", "Approximate value", "prefer_not_to_say", valueRangeOptions),
      text("documentLocation", "Document location"), text("insuranceContact", "Contact at provider"), notes(),
    ], ["providerName", "policyType", "lastFourDigits", "country", "approximateValueRange"]),
    category("crypto", "Crypto wallet", "Crypto references", schemas, [
      title(), select("cryptoType", "Crypto type", "bitcoin", [
        { label: "Bitcoin", value: "bitcoin" }, { label: "Ethereum", value: "ethereum" },
        { label: "Other", summaryLabel: "Other crypto", value: "other" },
      ]), text("walletIdentifier", "Wallet identifier", true, {
        helperText: "A short identifier or the last 4 characters of the wallet address.", maxLength: 16,
      }), text("exchangeName", "Exchange or platform"), text("country", "Country", true),
      select("approximateValueRange", "Approximate value", "prefer_not_to_say", valueRangeOptions),
      text("documentLocation", "Document location"), notes(),
    ], ["cryptoType", "walletIdentifier", "exchangeName", "country", "approximateValueRange"]),
    category("pension", "Pension", "Pensions", schemas, [
      title(), text("pensionProvider", "Pension provider", true),
      lastFour("Only the last 4 digits of the policy or account number."), text("country", "Country", true),
      select("approximateValueRange", "Approximate value", "prefer_not_to_say", valueRangeOptions),
      text("documentLocation", "Document location"), text("pensionContact", "Contact at provider"), notes(),
    ], ["pensionProvider", "lastFourDigits", "country", "approximateValueRange"]),
    category("loan_debt", "Loan or debt", "Loans and debts", schemas, [
      title("Reference title"), text("lenderName", "Lender", true), text("debtType", "Debt type", true),
      text("country", "Country", true), text("lastFourDigits", "Optional last 4/reference", false, { summaryPrefix: "reference" }),
      text("contact", "Contact details"), notes(),
    ], ["lenderName", "debtType", "lastFourDigits", "country"]),
  ] as const satisfies readonly SchemaDrivenVaultCategoryDefinition[];
}

function createPersonalCategories(schemas: VaultCategorySchemas) {
  return [
    category("subscription", "Subscription", "Subscriptions", schemas, [
      title(), text("serviceName", "Service name", true), select("subscriptionType", "Subscription type", "streaming", [
        { label: "Streaming", value: "streaming" }, { label: "Software", value: "software" },
        { label: "Utility", value: "utility" }, { label: "Other", summaryLabel: "Other subscription", value: "other" },
      ]), text("country", "Country", true), select("approximateCostRange", "Approximate monthly cost", "prefer_not_to_say", [
        { label: "Under 50 monthly", value: "under_50" }, { label: "50 to 200 monthly", value: "50_200" },
        { label: "200 to 500 monthly", value: "200_500" }, { label: "Over 500 monthly", value: "over_500" },
        { label: "Prefer not to say", summaryLabel: "Cost not stated", value: "prefer_not_to_say" },
      ]), text("documentLocation", "Document location"), text("subscriptionContact", "Contact"), notes(),
    ], ["serviceName", "subscriptionType", "country", "approximateCostRange"]),
    category("document_location", "Document location", "Document locations", schemas, [
      title(), select("documentType", "Document type", "will", [
        { label: "Will", value: "will" }, { label: "Deed", value: "deed" },
        { label: "Passport", value: "passport" },
        { label: "Marriage certificate", value: "marriage_certificate" },
        { label: "Divorce certificate", value: "divorce_certificate" },
        { label: "Other", summaryLabel: "Other document", value: "other" },
      ]), text("location", "Where is it kept?", true), text("country", "Country", true),
      text("custodian", "Who has custody?"), notes(),
    ], ["documentType", "location", "custodian", "country"]),
    category("contact", "Contact", "Contacts", schemas, [
      titleAndPayload("name", "Name"), select("relationship", "Relationship", "lawyer", [
        { label: "Lawyer", value: "lawyer" }, { label: "Accountant", value: "accountant" },
        { label: "Employer HR", value: "employer" }, { label: "Embassy", value: "embassy" },
        { label: "Other", summaryLabel: "Other contact", value: "other" },
      ]), text("phone", "Phone", false, { textInputMode: "tel" }),
      text("email", "Email", false, { textInputMode: "email" }), text("country", "Country", true), notes(),
    ], ["relationship", "phone", "email", "country"]),
    category("medical_care", "Medical care", "Medical care", schemas, [
      title("Reference title"), text("doctorOrClinic", "Doctor or clinic"),
      textarea("conditions", "Conditions or allergies"), textarea("medications", "Medications"),
      text("healthInsurance", "Health insurance"), textarea("emergencyPreferences", "Emergency preferences"), notes(),
    ], ["doctorOrClinic", "healthInsurance"]),
    category("dependent_pet", "Dependent or pet", "Dependents and pets", schemas, [
      title("Reference title"), text("name", "Name", true), text("relationship", "Relationship or type", true),
      text("careContact", "School, caregiver, or vet"), text("country", "Country"),
      textarea("careInstructions", "Care instructions"), notes(),
    ], ["name", "relationship", "careContact", "country"]),
    category("business_interest", "Business interest", "Business interests", schemas, [
      title("Reference title"), text("companyName", "Company name", true), text("roleOrOwnership", "Role or ownership"),
      text("country", "Registration country", true), text("contact", "Key contact"),
      textarea("instructions", "Continuity instructions"), notes(),
    ], ["companyName", "roleOrOwnership", "country", "contact"]),
    category("digital_account", "Digital account", "Digital accounts", schemas, [
      title("Reference title"), text("serviceName", "Service name", true), text("accountType", "Account type"),
      text("legacyContact", "Recovery or legacy contact"), text("passwordManagerName", "Password manager name"),
      textarea("instructions", "Close or preserve instructions"), notes(),
    ], ["serviceName", "accountType", "legacyContact", "passwordManagerName"]),
    category("other", "Other", "Other records", schemas, [
      title(), textarea("description", "Description"), text("category", "Category or tag"), text("country", "Country", true),
      text("approximateValue", "Approximate value"), text("documentLocation", "Where is the document kept?"), notes(),
    ], ["category", "description", "country", "approximateValue"]),
  ] as const satisfies readonly SchemaDrivenVaultCategoryDefinition[];
}

export function createVaultCategoryRegistry(schemas: VaultCategorySchemas) {
  const categories = [...createFinancialCategories(schemas), ...createPersonalCategories(schemas)];
  assertCompleteRegistry(categories);
  const byAssetType = Object.fromEntries(
    categories.map((definition) => [definition.assetType, definition]),
  ) as Record<AssetType, SchemaDrivenVaultCategoryDefinition>;

  return {
    byAssetType,
    categories,
    createInitialValues: (definition: SchemaDrivenVaultCategoryDefinition, payload?: {
      fields: Record<string, unknown>; notes?: string; title: string;
    }) => Object.fromEntries(definition.fields.map((field) => {
      if (!payload) return [field.name, field.defaultValue];
      if (field.role === "title" || field.role === "title_and_payload") return [field.name, payload.title];
      if (field.role === "notes") return [field.name, payload.notes ?? field.defaultValue];
      const value = payload.fields[field.name];
      return [field.name, typeof value === "string" ? value : field.defaultValue];
    })),
    createPayload: (definition: SchemaDrivenVaultCategoryDefinition, values: unknown, existingFields: Record<string, string> = {}) =>
      createPayload(definition, values, existingFields),
    formatSummary: (definition: SchemaDrivenVaultCategoryDefinition, fields: Record<string, string>, separator = " · ") =>
      definition.summaryFields.map((name) => formatSummaryField(definition, name, fields[name])).filter(Boolean).join(separator),
    getCategory: (assetType: string | undefined) => assetType ? byAssetType[assetType as AssetType] : undefined,
  };
}

function category(assetType: AssetType, categoryLabel: string, pluralLabel: string, schemas: VaultCategorySchemas,
  fields: readonly VaultCategoryFieldDefinition[], summaryFields: readonly string[]): SchemaDrivenVaultCategoryDefinition {
  return { assetType, categoryLabel, fields, pluralLabel, schema: schemas[assetType], securityClass: "encrypted_payload_only", summaryFields, version: 1 };
}

function text(name: string, label: string, required = false, extras: Partial<VaultCategoryFieldDefinition> = {}): VaultCategoryFieldDefinition {
  return { control: "text", defaultValue: "", label, name, required, role: "payload", textInputMode: "text", ...extras };
}

function textarea(name: string, label: string): VaultCategoryFieldDefinition {
  return { control: "textarea", defaultValue: "", label, name, required: false, role: "payload" };
}

function title(label = "Title"): VaultCategoryFieldDefinition {
  return { control: "text", defaultValue: "", label, name: "title", required: true, role: "title", textInputMode: "text" };
}

function titleAndPayload(name: string, label: string): VaultCategoryFieldDefinition {
  return { control: "text", defaultValue: "", label, name, required: true, role: "title_and_payload", textInputMode: "text" };
}

function notes(): VaultCategoryFieldDefinition {
  return { control: "textarea", defaultValue: "", label: "Notes for family", name: "notes", required: false, role: "notes" };
}

function select(name: string, label: string, defaultValue: string,
  options: readonly { label: string; summaryLabel?: string; value: string }[]): VaultCategoryFieldDefinition {
  return { control: "select", defaultValue, label, name, options, required: true, role: "payload" };
}

function lastFour(helperText: string): VaultCategoryFieldDefinition {
  return text("lastFourDigits", "Last 4 digits only", true, {
    helperText, maxLength: 4, pattern: "[0-9]{4}", summaryPrefix: "ending", textInputMode: "numeric",
  });
}

function optionalLastFour(helperText: string): VaultCategoryFieldDefinition {
  return { ...lastFour(helperText), required: false };
}

function createPayload(definition: SchemaDrivenVaultCategoryDefinition, values: unknown,
  existingFields: Record<string, string>): SchemaDrivenVaultPayload {
  const parsed = definition.schema.parse(values) as Record<string, string | undefined>;
  const titleField = definition.fields.find(({ role }) => role === "title" || role === "title_and_payload");
  const notesField = definition.fields.find(({ role }) => role === "notes");
  if (!titleField) throw new Error("A schema-driven title is required.");
  const knownFieldNames = new Set(definition.fields.filter(({ role }) => role !== "notes").map(({ name }) => name));
  const preservedFields = Object.fromEntries(Object.entries(existingFields).filter(([name]) => !knownFieldNames.has(name)));
  const fields = Object.fromEntries(definition.fields
    .filter(({ role }) => role === "payload" || role === "title_and_payload")
    .map(({ name }) => [name, parsed[name]] as const)
    .filter((entry): entry is [string, string] => Boolean(entry[1])));
  const payloadTitle = parsed[titleField.name];
  if (!payloadTitle) throw new Error("A schema-driven title is required.");
  return { assetType: definition.assetType, fields: { ...preservedFields, ...fields },
    notes: notesField ? parsed[notesField.name] : undefined, title: payloadTitle };
}

function formatSummaryField(definition: SchemaDrivenVaultCategoryDefinition, name: string, value: string | undefined) {
  if (!value) return undefined;
  const field = definition.fields.find((candidate) => candidate.name === name);
  const option = field?.options?.find((candidate) => candidate.value === value);
  const label = option?.summaryLabel ?? option?.label ?? value;
  return field?.summaryPrefix ? `${field.summaryPrefix} ${label}` : label;
}

function assertCompleteRegistry(categories: readonly SchemaDrivenVaultCategoryDefinition[]) {
  const registered = categories.map(({ assetType }) => assetType);
  if (new Set(registered).size !== registered.length || assetTypes.some((assetType) => !registered.includes(assetType))) {
    throw new Error("The vault category registry must contain every asset type exactly once.");
  }
}
