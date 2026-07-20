import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebCryptoPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("crypto", values, existingFields);
