import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type CryptoFormField = DynamicFormField;
export type CryptoFormViewModel = SchemaDrivenVaultFormViewModel;
export const createCryptoFormViewModel = () => createVaultFormViewModel("crypto");
