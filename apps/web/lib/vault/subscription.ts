import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebSubscriptionPayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("subscription", values, existingFields);
