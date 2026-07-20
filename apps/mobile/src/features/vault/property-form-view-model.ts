import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type PropertyFormField = DynamicFormField;
export type PropertyFormViewModel = SchemaDrivenVaultFormViewModel;
export const createPropertyFormViewModel = () => createVaultFormViewModel("property");
