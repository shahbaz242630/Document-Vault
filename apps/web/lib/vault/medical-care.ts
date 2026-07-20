import { createWebSchemaDrivenPayload } from "./schema-driven-payload";

export const createWebMedicalCarePayload = (values: unknown, existingFields?: Record<string, string>) =>
  createWebSchemaDrivenPayload("medical_care", values, existingFields);
