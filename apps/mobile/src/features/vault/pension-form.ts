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

const pensionFormSchema = z.object({
  approximateValueRange: valueRangeSchema,
  country: requiredTextSchema,
  documentLocation: optionalTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTextSchema,
  pensionContact: optionalTextSchema,
  pensionProvider: requiredTextSchema,
  title: requiredTextSchema,
});

export type PensionFormValues = z.input<typeof pensionFormSchema>;

export function createPensionAssetPayload(
  values: PensionFormValues,
): AssetPlaintextPayload {
  const parsed = pensionFormSchema.parse(values);

  return {
    assetType: "pension",
    fields: removeBlankFields({
      approximateValueRange: parsed.approximateValueRange,
      country: parsed.country,
      documentLocation: parsed.documentLocation,
      lastFourDigits: parsed.lastFourDigits,
      pensionProvider: parsed.pensionProvider,
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
