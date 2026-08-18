import { createHash } from "node:crypto";

import { z } from "zod";

import type { RetrievalLifecycleClosureResultV1,
  RetrievalLifecycleClosureTransactionClientV1 }
  from "./retrieval-lifecycle-closure-transaction-client.js";

export const CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED = false as const;

export type NativeExportFactVerifierV1 = Readonly<{
  verify(input: Readonly<{ expected: z.infer<typeof expectedExportFactSchema>;
    receipt: unknown }>): Promise<unknown>;
}>;

export class RetrievalLifecycleClosureServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "verification_failed") {
    super("Retrieval lifecycle closure is unavailable.");
    this.name = "RetrievalLifecycleClosureServiceError";
  }
}

export function createRetrievalLifecycleClosureServiceV1(input: Readonly<{
  approved?: boolean; exportFactVerifier: NativeExportFactVerifierV1;
  transactions: RetrievalLifecycleClosureTransactionClientV1;
}>) {
  return { async close(value: unknown): Promise<RetrievalLifecycleClosureResultV1> {
    if (!(input.approved ?? CLAIMANT_RETRIEVAL_LIFECYCLE_CLOSURE_APPROVED))
      throw new RetrievalLifecycleClosureServiceError("disabled");
    const request = requestSchema.safeParse(value);
    if (!request.success) throw new RetrievalLifecycleClosureServiceError("invalid_input");
    let exportReceiptDigest: string | null = null;
    let verifiedExportFactDigest: string | null = null;
    let exportedAt: string | null = null;
    if (request.data.exportReceipt !== null) {
      const expected = { caseId: request.data.caseId, closureId: request.data.closureId,
        completionId: request.data.completionId, deliveryId: request.data.deliveryId,
        releasePackageId: request.data.releasePackageId,
        retrievalSessionId: request.data.retrievalSessionId };
      let fact: z.infer<typeof verifiedExportFactSchema>;
      try {
        const parsed = verifiedExportFactSchema.safeParse(await input.exportFactVerifier.verify({
          expected, receipt: request.data.exportReceipt }));
        if (!parsed.success) verificationFailed();
        fact = parsed.data;
      } catch (error) {
        if (error instanceof RetrievalLifecycleClosureServiceError) throw error;
        verificationFailed();
      }
      if (!matches(expected, fact) || canonicalTimestamp(fact.exportedAt) !== fact.exportedAt)
        verificationFailed();
      exportReceiptDigest = sha256(fact.exportReceiptReference);
      exportedAt = fact.exportedAt;
      verifiedExportFactDigest = sha256(["sanduqkin:claim:local-export-receipt:v1",
        request.data.closureId, fact.completionId,
        fact.deliveryId, fact.retrievalSessionId, fact.caseId, fact.releasePackageId,
        String(fact.assetCount), exportReceiptDigest, fact.exportedAt, fact.destinationClass,
        String(fact.localCopyCreated), String(fact.plaintextReturnedToJavaScript),
        String(fact.serverUploadPerformed), String(fact.closureRecorded),
        fact.status].join("|"));
    }
    try {
      return await input.transactions.close({ caseId: request.data.caseId,
        closureId: request.data.closureId, closureReason: request.data.closureReason,
        completionId: request.data.completionId, deliveryId: request.data.deliveryId,
        expectedCaseVersion: request.data.expectedCaseVersion,
        exportPerformed: request.data.exportReceipt !== null, exportReceiptDigest, exportedAt,
        idempotencyKey: request.data.idempotencyKey,
        releasePackageId: request.data.releasePackageId,
        retrievalSessionId: request.data.retrievalSessionId, verifiedExportFactDigest });
    } catch { verificationFailed(); }
  } };
}

function matches(expected: z.infer<typeof expectedExportFactSchema>,
  fact: z.infer<typeof verifiedExportFactSchema>) {
  return expected.caseId === fact.caseId
    && expected.completionId === fact.completionId && expected.deliveryId === fact.deliveryId
    && expected.releasePackageId === fact.releasePackageId
    && expected.retrievalSessionId === fact.retrievalSessionId;
}
function canonicalTimestamp(value: string) { return new Date(value).toISOString(); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function verificationFailed(): never {
  throw new RetrievalLifecycleClosureServiceError("verification_failed");
}

const uuid = z.string().uuid();
const expectedExportFactSchema = z.strictObject({ caseId: uuid, closureId: uuid,
  completionId: uuid, deliveryId: uuid, releasePackageId: uuid,
  retrievalSessionId: uuid });
const verifiedExportFactSchema = expectedExportFactSchema.extend({
  assetCount: z.number().int().min(1).max(100), closureRecorded: z.literal(false),
  destinationClass: z.literal("user_selected_local_copy"),
  exportedAt: z.string().datetime({ offset: true }), exportReceiptReference: z.string()
    .regex(/^claimant-local-export\.v1\.[0-9a-f-]{36}$/u), localCopyCreated: z.literal(true),
  plaintextReturnedToJavaScript: z.literal(false), serverUploadPerformed: z.literal(false),
  status: z.literal("exported") }).omit({ closureId: true });
const requestSchema = z.strictObject({ caseId: uuid, closureId: uuid,
  closureReason: z.literal("retrieval_lifecycle_complete"), completionId: uuid, deliveryId: uuid,
  expectedCaseVersion: z.number().int().min(5), exportReceipt: z.unknown().nullable(),
  idempotencyKey: uuid, releasePackageId: uuid, retrievalSessionId: uuid });
