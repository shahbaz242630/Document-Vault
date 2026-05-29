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

const bankAccountFormSchema = z.object({
  approximateValueRange: valueRangeSchema,
  country: requiredTextSchema,
  currency: requiredTextSchema,
  documentLocation: optionalTextSchema,
  institutionContact: optionalTextSchema,
  institutionName: requiredTextSchema,
  lastFourDigits: lastFourDigitsSchema,
  notes: optionalTextSchema,
  title: requiredTextSchema,
});

export type BankAccountFormValues = z.input<typeof bankAccountFormSchema>;

export function createBankAccountAssetPayload(
  values: BankAccountFormValues,
): AssetPlaintextPayload {
  const parsed = bankAccountFormSchema.parse(values);

  return {
    assetType: "bank_account",
    fields: removeBlankFields({
      approximateValueRange: parsed.approximateValueRange,
      country: parsed.country,
      currency: parsed.currency,
      documentLocation: parsed.documentLocation,
      institutionContact: parsed.institutionContact,
      institutionName: parsed.institutionName,
      lastFourDigits: parsed.lastFourDigits,
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
