import type { DynamicFormField } from "./components/dynamic-asset-form";
import { createVaultFormViewModel, type SchemaDrivenVaultFormViewModel } from "./schema-driven-form-view-model";

export type SubscriptionFormField = DynamicFormField;
export type SubscriptionFormViewModel = SchemaDrivenVaultFormViewModel;
export const createSubscriptionFormViewModel = () => createVaultFormViewModel("subscription");
