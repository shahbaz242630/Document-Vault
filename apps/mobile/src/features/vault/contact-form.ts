import type { ContactFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { ContactFormValues } from "@vault/shared-validation";
export const createContactAssetPayload = (values: ContactFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("contact", values);
