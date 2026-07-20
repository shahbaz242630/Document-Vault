import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type DocumentLocationFormField = DynamicFormField;
export type DocumentLocationFormViewModel = SchemaDrivenVaultFormViewModel;
export const createDocumentLocationFormViewModel = () => createVaultFormViewModel("document_location");
