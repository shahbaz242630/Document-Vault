import type { AssetPlaintextPayload, AssetType } from "./asset-payload";
import type { DynamicFormField } from "./components/dynamic-asset-form";

const expandedAssetConfigs = {
  business_interest: {
    categoryLabel: "Business interest",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Company name", name: "companyName", required: true, type: "text" },
      { label: "Role or ownership", name: "roleOrOwnership", required: false, type: "text" },
      { label: "Registration country", name: "country", required: true, type: "text" },
      { label: "Key contact", name: "contact", required: false, type: "text" },
      { label: "Continuity instructions", name: "instructions", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      companyName: "",
      contact: "",
      country: "",
      instructions: "",
      notes: "",
      roleOrOwnership: "",
      title: "",
    },
  },
  card: {
    categoryLabel: "Card",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Issuer or bank", name: "issuerName", required: true, type: "text" },
      { label: "Card type", name: "cardType", required: false, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      {
        helperText: "Store only the last 4 digits.",
        keyboardType: "numeric",
        label: "Last 4 digits",
        name: "lastFourDigits",
        required: false,
        type: "text",
      },
      { label: "Support phone or website", name: "supportContact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      cardType: "",
      country: "",
      issuerName: "",
      lastFourDigits: "",
      notes: "",
      supportContact: "",
      title: "",
    },
  },
  dependent_pet: {
    categoryLabel: "Dependent or pet",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Name", name: "name", required: true, type: "text" },
      { label: "Relationship or type", name: "relationship", required: true, type: "text" },
      { label: "School, caregiver, or vet", name: "careContact", required: false, type: "text" },
      { label: "Country", name: "country", required: false, type: "text" },
      { label: "Care instructions", name: "careInstructions", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      careContact: "",
      careInstructions: "",
      country: "",
      name: "",
      notes: "",
      relationship: "",
      title: "",
    },
  },
  digital_account: {
    categoryLabel: "Digital account",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Service name", name: "serviceName", required: true, type: "text" },
      { label: "Account type", name: "accountType", required: false, type: "text" },
      { label: "Recovery or legacy contact", name: "legacyContact", required: false, type: "text" },
      { label: "Password manager name", name: "passwordManagerName", required: false, type: "text" },
      { label: "Close or preserve instructions", name: "instructions", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      accountType: "",
      instructions: "",
      legacyContact: "",
      notes: "",
      passwordManagerName: "",
      serviceName: "",
      title: "",
    },
  },
  loan_debt: {
    categoryLabel: "Loan or debt",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Lender", name: "lenderName", required: true, type: "text" },
      { label: "Debt type", name: "debtType", required: true, type: "text" },
      { label: "Country", name: "country", required: true, type: "text" },
      { label: "Optional last 4/reference", name: "lastFourDigits", required: false, type: "text" },
      { label: "Contact details", name: "contact", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      contact: "",
      country: "",
      debtType: "",
      lastFourDigits: "",
      lenderName: "",
      notes: "",
      title: "",
    },
  },
  medical_care: {
    categoryLabel: "Medical care",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Doctor or clinic", name: "doctorOrClinic", required: false, type: "text" },
      { label: "Conditions or allergies", name: "conditions", required: false, type: "text" },
      { label: "Medications", name: "medications", required: false, type: "text" },
      { label: "Health insurance", name: "healthInsurance", required: false, type: "text" },
      { label: "Emergency preferences", name: "emergencyPreferences", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      conditions: "",
      doctorOrClinic: "",
      emergencyPreferences: "",
      healthInsurance: "",
      medications: "",
      notes: "",
      title: "",
    },
  },
  vehicle: {
    categoryLabel: "Vehicle",
    fields: [
      { label: "Reference title", name: "title", required: true, type: "text" },
      { label: "Vehicle type", name: "vehicleType", required: true, type: "text" },
      { label: "Make and model", name: "makeModel", required: true, type: "text" },
      { label: "Registration plate", name: "registrationPlate", required: false, type: "text" },
      { label: "Country or state", name: "country", required: true, type: "text" },
      { label: "Document or spare key location", name: "documentLocation", required: false, type: "text" },
      { label: "Notes for family", name: "notes", required: false, type: "text" },
    ],
    initialValues: {
      country: "",
      documentLocation: "",
      makeModel: "",
      notes: "",
      registrationPlate: "",
      title: "",
      vehicleType: "",
    },
  },
} as const satisfies Record<
  ExpandedAssetType,
  {
    categoryLabel: string;
    fields: DynamicFormField[];
    initialValues: Record<string, string>;
  }
>;

type ExpandedAssetType = Extract<
  AssetType,
  | "business_interest"
  | "card"
  | "dependent_pet"
  | "digital_account"
  | "loan_debt"
  | "medical_care"
  | "vehicle"
>;

export function createExpandedAssetPayload({
  assetType,
  values,
}: {
  assetType: ExpandedAssetType;
  values: Record<string, string>;
}): AssetPlaintextPayload {
  const config = getExpandedAssetConfig(assetType);
  const title = values.title?.trim();

  if (!title) {
    throw new Error("Reference title is required.");
  }

  for (const field of config.fields) {
    if (field.name === "title" || field.name === "notes" || !field.required) {
      continue;
    }

    if (!values[field.name]?.trim()) {
      throw new Error(`${field.label} is required.`);
    }
  }

  const fields = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([key, value]) => key !== "title" && key !== "notes" && value.length > 0),
  );

  return {
    assetType,
    fields,
    notes: values.notes?.trim() || undefined,
    title,
  };
}

export function getExpandedAssetConfig(assetType: ExpandedAssetType) {
  return expandedAssetConfigs[assetType];
}

export type { ExpandedAssetType };
