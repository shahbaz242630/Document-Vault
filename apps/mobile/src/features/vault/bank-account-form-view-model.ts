import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type BankAccountFormField = DynamicFormField;
export type BankAccountFormViewModel = SchemaDrivenVaultFormViewModel;
export const createBankAccountFormViewModel = () => createVaultFormViewModel("bank_account");
