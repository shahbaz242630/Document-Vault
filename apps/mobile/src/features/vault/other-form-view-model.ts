import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type OtherFormField = DynamicFormField;
export type OtherFormViewModel = SchemaDrivenVaultFormViewModel;
export const createOtherFormViewModel = () => createVaultFormViewModel("other");
