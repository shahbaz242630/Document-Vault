import type { DocumentLocationFormValues } from "@vault/shared-validation";

import { createMobileSchemaDrivenPayload } from "./schema-driven-asset-payload";

export type { DocumentLocationFormValues } from "@vault/shared-validation";
export const createDocumentLocationAssetPayload = (values: DocumentLocationFormValues | Record<string, string>) =>
  createMobileSchemaDrivenPayload("document_location", values);
