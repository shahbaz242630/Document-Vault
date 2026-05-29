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

const cryptoFormSchema = z.object({
  approximateValueRange: valueRangeSchema,
  country: requiredTextSchema,
  cryptoType: z.enum(["bitcoin", "ethereum", "other"]),
  documentLocation: optionalTextSchema,
  exchangeName: optionalTextSchema,
  notes: optionalTextSchema,
  title: requiredTextSchema,
  walletIdentifier: requiredTextSchema,
});

export type CryptoFormValues = z.input<typeof cryptoFormSchema>;

export function createCryptoAssetPayload(
  values: CryptoFormValues,
): AssetPlaintextPayload {
  const parsed = cryptoFormSchema.parse(values);

  return {
    assetType: "crypto",
    fields: removeBlankFields({
      approximateValueRange: parsed.approximateValueRange,
      country: parsed.country,
      cryptoType: parsed.cryptoType,
      documentLocation: parsed.documentLocation,
      exchangeName: parsed.exchangeName,
      walletIdentifier: parsed.walletIdentifier,
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
