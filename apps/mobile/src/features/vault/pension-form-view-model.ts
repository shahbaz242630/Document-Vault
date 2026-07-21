import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type PensionFormField = DynamicFormField;
export type PensionFormViewModel = SchemaDrivenVaultFormViewModel;
export const createPensionFormViewModel = () => createVaultFormViewModel("pension");
