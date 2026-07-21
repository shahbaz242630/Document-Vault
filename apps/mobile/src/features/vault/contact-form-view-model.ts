import {
  contactVaultCategoryDefinition,
} from "@vault/shared-validation";

import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createSchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type ContactFormField = DynamicFormField;

export type ContactFormViewModel = {
  categoryLabel: string;
  fields: ContactFormField[];
  initialValues: Record<string, string>;
};

export function createContactFormViewModel(): ContactFormViewModel {
  return createSchemaDrivenVaultFormViewModel(contactVaultCategoryDefinition);
}
