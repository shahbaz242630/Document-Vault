import { z } from "zod";

import type { RetrievalAccessControlResultV1,
  RetrievalAccessControlTransactionClientV1 }
  from "./retrieval-access-control-transaction-client.js";

export const CLAIMANT_RETRIEVAL_ACCESS_CONTROL_APPROVED = false as const;

export class RetrievalAccessControlServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "control_failed") {
    super("Retrieval access control is unavailable.");
    this.name = "RetrievalAccessControlServiceError";
  }
}

export function createRetrievalAccessControlServiceV1(input: Readonly<{ approved?: boolean;
  transactions: RetrievalAccessControlTransactionClientV1 }>) {
  return { async endAccess(value: unknown): Promise<RetrievalAccessControlResultV1> {
    if (!(input.approved ?? CLAIMANT_RETRIEVAL_ACCESS_CONTROL_APPROVED))
      throw new RetrievalAccessControlServiceError("disabled");
    const request = requestSchema.safeParse(value);
    if (!request.success) throw new RetrievalAccessControlServiceError("invalid_input");
    try { return await input.transactions.endAccess(request.data); }
    catch { throw new RetrievalAccessControlServiceError("control_failed"); }
  } };
}

const uuid = z.string().uuid();
const baseRequestSchema = z.strictObject({ caseId: uuid, controlId: uuid,
  expectedCaseVersion: z.number().int().min(4), finalizationId: uuid,
  idempotencyKey: uuid });
const requestSchema = z.discriminatedUnion("controlState", [
  baseRequestSchema.extend({ controlState: z.literal("suspended"),
    reason: z.literal("synthetic_security_hold") }),
  baseRequestSchema.extend({ controlState: z.literal("expired"),
    reason: z.literal("package_expired") }),
]);
