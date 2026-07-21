import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebDocumentLocationPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("document_location", values, existingFields);
