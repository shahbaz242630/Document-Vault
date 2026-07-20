import {
  createSchemaDrivenVaultInitialValues,
  getSchemaDrivenVaultCategory,
  type SchemaDrivenVaultCategoryDefinition,
} from "@vault/shared-validation";
import type { AssetType } from "@vault/shared-types";

import type { DynamicFormField } from "./components/dynamic-asset-form";

export type SchemaDrivenVaultFormViewModel = {
  categoryLabel: string;
  fields: DynamicFormField[];
  initialValues: Record<string, string>;
};

export function createSchemaDrivenVaultFormViewModel(
  definition: SchemaDrivenVaultCategoryDefinition,
): SchemaDrivenVaultFormViewModel {
  return {
    categoryLabel: definition.categoryLabel,
    fields: definition.fields.map((field) => field.control === "select"
      ? {
          label: field.label,
          name: field.name,
          options: (field.options ?? []).map(({ label, value }) => ({ label, value })),
          required: field.required,
          type: "select",
        }
      : {
          helperText: field.helperText,
          keyboardType: toKeyboardType(field.textInputMode),
          label: field.label,
          name: field.name,
          required: field.required,
          type: "text",
        }),
    initialValues: createSchemaDrivenVaultInitialValues(definition),
  };
}

export function createVaultFormViewModel(assetType: AssetType) {
  const definition = getSchemaDrivenVaultCategory(assetType);
  if (!definition) throw new Error(`Missing shared vault category: ${assetType}`);
  return createSchemaDrivenVaultFormViewModel(definition);
}

function toKeyboardType(inputMode: "email" | "numeric" | "tel" | "text" | undefined) {
  if (inputMode === "email") return "email-address" as const;
  if (inputMode === "numeric") return "numeric" as const;
  if (inputMode === "tel") return "phone-pad" as const;
  return undefined;
}
