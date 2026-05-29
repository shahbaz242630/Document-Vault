import { z } from "zod";

import { lastFourDigitsSchema } from "@vault/shared-validation";

import type { AssetPlaintextPayload } from "./asset-payload";

const valueRangeSchema = z.enum([
  "under_50k",
  "50_200k",
  "200_500k",
  "500k_1m",
  "over_1m",
  "prefer_not_to_say",
]);

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const insuranceFormSchema = z.object({
  approximateValueRange: valueRangeSchema,
  country: requiredTextSchema,
  documentLocation: optionalTextSchema,
  insuranceContact: optionalTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTextSchema,
  policyType: z.enum(["life", "health", "property", "auto", "other"]),
  providerName: requiredTextSchema,
  title: requiredTextSchema,
});

export type InsuranceFormValues = z.input<typeof insuranceFormSchema>;

export function createInsuranceAssetPayload(
  values: InsuranceFormValues,
): AssetPlaintextPayload {
  const parsed = insuranceFormSchema.parse(values);

  return {
    assetType: "insurance",
    fields: removeBlankFields({
      approximateValueRange: parsed.approximateValueRange,
      country: parsed.country,
      documentLocation: parsed.documentLocation,
      insuranceContact: parsed.insuranceContact,
      lastFourDigits: parsed.lastFourDigits,
      policyType: parsed.policyType,
      providerName: parsed.providerName,
    }),
    notes: parsed.notes,
    title: parsed.title,
  };
}

function removeBlankFields(fields: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
