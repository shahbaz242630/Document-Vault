import { createHash } from "node:crypto";
import { z } from "zod";

import type { EncryptedDeliveryCommittedV1,
  EncryptedPackageDeliveryTransactionClientV1 }
  from "./encrypted-package-delivery-transaction-client.js";

export const CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED = false as const;
export const ENCRYPTED_PACKAGE_DELIVERY_TIMEOUT_MS = 10_000;

export type EncryptedPackageDeliveryAdapterV1 = Readonly<{
  dispatch(input: Readonly<{ deliveryKey: string; payload: string; payloadBytes: number;
    payloadDigest: string; signal: AbortSignal }>): Promise<unknown>;
  lookup(input: Readonly<{ deliveryKey: string; signal: AbortSignal }>): Promise<unknown>;
}>;

export class EncryptedPackageDeliveryError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "invalid_authority" |
    "reconciliation_required") {
    super("Encrypted package delivery is unavailable.");
    this.name = "EncryptedPackageDeliveryError";
  }
}

export function createEncryptedPackageDeliveryCoordinatorV1(input: Readonly<{
  adapter: EncryptedPackageDeliveryAdapterV1; approved?: boolean;
  transactions: EncryptedPackageDeliveryTransactionClientV1;
}>) {
  let running = false;
  return { async deliver(value: unknown): Promise<EncryptedDeliveryCommittedV1> {
    if (!(input.approved ?? CLAIMANT_ENCRYPTED_PACKAGE_DELIVERY_APPROVED)) {
      throw new EncryptedPackageDeliveryError("disabled");
    }
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) throw new EncryptedPackageDeliveryError("invalid_input");
    if (running) throw new EncryptedPackageDeliveryError("reconciliation_required");
    running = true;
    try {
      let prepared;
      try { prepared = await input.transactions.prepare(parsed.data); }
      catch { throw new EncryptedPackageDeliveryError("invalid_authority"); }
      if (prepared.deliveryId !== parsed.data.deliveryId
        || prepared.deliveryKey !== parsed.data.deliveryKey
        || prepared.retrievalSessionId !== parsed.data.retrievalSessionId
        || prepared.caseId !== parsed.data.caseId
        || prepared.caseVersion !== parsed.data.expectedCaseVersion
        || createHash("sha256").update(prepared.deliveryPayload).digest("hex")
          !== prepared.payloadDigest
        || Buffer.byteLength(prepared.deliveryPayload, "utf8") !== prepared.payloadBytes) {
        throw new EncryptedPackageDeliveryError("invalid_authority");
      }
      if (!prepared.replayed) {
        try {
          const acknowledgement = dispatchSchema.safeParse(await boundedCall((signal) =>
            input.adapter.dispatch({ deliveryKey: prepared.deliveryKey,
              payload: prepared.deliveryPayload, payloadBytes: prepared.payloadBytes,
              payloadDigest: prepared.payloadDigest, signal })));
          if (!acknowledgement.success
            || acknowledgement.data.deliveryKey !== prepared.deliveryKey) {
            throw new Error("invalid delivery acknowledgement");
          }
        } catch { /* lookup is the only complete-delivery authority */ }
      }
      let lookup: z.infer<typeof lookupSchema>;
      try {
        const observed = lookupSchema.safeParse(await boundedCall((signal) =>
          input.adapter.lookup({ deliveryKey: prepared.deliveryKey, signal })));
        if (!observed.success || observed.data.deliveryKey !== prepared.deliveryKey) {
          throw new Error("invalid delivery lookup");
        }
        lookup = observed.data;
      } catch { throw new EncryptedPackageDeliveryError("reconciliation_required"); }
      if (lookup.status !== "verified" || lookup.payloadDigest !== prepared.payloadDigest
        || lookup.payloadBytes !== prepared.payloadBytes
        || Date.parse(lookup.completedAt) > Date.parse(prepared.leaseExpiresAt)) {
        throw new EncryptedPackageDeliveryError("reconciliation_required");
      }
      const receiptDigest = createHash("sha256").update([
        "sanduqkin:claim:encrypted-delivery-receipt:v1", lookup.deliveryKey,
        lookup.payloadDigest, String(lookup.payloadBytes), lookup.completedAt,
        lookup.receiptRef,
      ].join("|")).digest("hex");
      try {
        return await input.transactions.commit({ completedAt: lookup.completedAt,
          deliveryId: prepared.deliveryId, deliveryKey: lookup.deliveryKey,
          idempotencyKey: parsed.data.commitIdempotencyKey,
          payloadBytes: lookup.payloadBytes, payloadDigest: lookup.payloadDigest,
          receiptDigest, receiptRef: lookup.receiptRef });
      } catch { throw new EncryptedPackageDeliveryError("reconciliation_required"); }
    } finally { running = false; }
  } };
}

async function boundedCall<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController(); let timeout: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation(controller.signal), new Promise<never>((_r, reject) => {
    timeout = setTimeout(() => { controller.abort(); reject(new Error("delivery timeout")); },
      ENCRYPTED_PACKAGE_DELIVERY_TIMEOUT_MS);
  })]); } finally { if (timeout !== undefined) clearTimeout(timeout); }
}

const uuid = z.string().uuid(); const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const requestSchema = z.strictObject({ caseId: uuid, commitIdempotencyKey: uuid,
  deliveryId: uuid, deliveryKey: z.string()
    .regex(/^synthetic_package_delivery_[a-z0-9_]{1,100}$/u),
  expectedCaseVersion: z.number().int().min(4), idempotencyKey: uuid,
  retrievalSessionId: uuid });
const dispatchSchema = z.strictObject({ accepted: z.boolean(), deliveryKey: z.string() });
const verifiedSchema = z.strictObject({ completedAt: z.string().datetime({ offset: true }),
  deliveryKey: z.string(), payloadBytes: z.number().int().min(512).max(12_582_912),
  payloadDigest: digest, receiptRef: z.string()
    .regex(/^synthetic_delivery_receipt_[a-z0-9_]{1,100}$/u), status: z.literal("verified") });
const lookupSchema = z.discriminatedUnion("status", [verifiedSchema,
  z.strictObject({ deliveryKey: z.string(), status: z.literal("failed") }),
  z.strictObject({ deliveryKey: z.string(), status: z.literal("unknown") })]);
