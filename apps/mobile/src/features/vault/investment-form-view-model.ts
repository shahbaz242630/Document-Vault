import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type InvestmentFormField = DynamicFormField;
export type InvestmentFormViewModel = SchemaDrivenVaultFormViewModel;
export const createInvestmentFormViewModel = () => createVaultFormViewModel("investment");
