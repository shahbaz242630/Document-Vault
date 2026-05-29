import { z } from "zod";

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

const propertyFormSchema = z.object({
  address: requiredTextSchema,
  approximateValueRange: valueRangeSchema,
  contact: optionalTextSchema,
  country: requiredTextSchema,
  documentLocation: optionalTextSchema,
  mortgageProvider: optionalTextSchema,
  notes: optionalTextSchema,
  title: requiredTextSchema,
});

export type PropertyFormValues = z.input<typeof propertyFormSchema>;

export function createPropertyAssetPayload(
  values: PropertyFormValues,
): AssetPlaintextPayload {
  const parsed = propertyFormSchema.parse(values);

  return {
    assetType: "property",
    fields: removeBlankFields({
      address: parsed.address,
      approximateValueRange: parsed.approximateValueRange,
      contact: parsed.contact,
      country: parsed.country,
      documentLocation: parsed.documentLocation,
      mortgageProvider: parsed.mortgageProvider,
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
