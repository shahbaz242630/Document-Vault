import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type InsuranceFormField = DynamicFormField;
export type InsuranceFormViewModel = SchemaDrivenVaultFormViewModel;
export const createInsuranceFormViewModel = () => createVaultFormViewModel("insurance");
