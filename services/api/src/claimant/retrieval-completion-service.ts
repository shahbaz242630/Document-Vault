import { createHash } from "node:crypto";

import { z } from "zod";

import type { RetrievalCompletionResultV1, RetrievalCompletionTransactionClientV1 }
  from "./retrieval-completion-transaction-client.js";

export const CLAIMANT_RETRIEVAL_COMPLETION_APPROVED = false as const;

export type NativeOpenProofVerifierV1 = Readonly<{
  verify(input: Readonly<{ expected: z.infer<typeof expectedProofSchema>;
    proof: unknown }>): Promise<unknown>;
}>;

export class RetrievalCompletionServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "verification_failed") {
    super("Retrieval completion is unavailable."); this.name = "RetrievalCompletionServiceError";
  }
}

export function createRetrievalCompletionServiceV1(input: Readonly<{ approved?: boolean;
  proofVerifier: NativeOpenProofVerifierV1; transactions: RetrievalCompletionTransactionClientV1;
}>) {
  return { async complete(value: unknown): Promise<RetrievalCompletionResultV1> {
    if (!(input.approved ?? CLAIMANT_RETRIEVAL_COMPLETION_APPROVED))
      throw new RetrievalCompletionServiceError("disabled");
    const request = requestSchema.safeParse(value);
    if (!request.success || canonicalTimestamp(request.data.openedAt) !== request.data.openedAt)
      throw new RetrievalCompletionServiceError("invalid_input");
    const expected = { caseId: request.data.caseId, claimantKeyId: request.data.claimantKeyId,
      completionId: request.data.completionId, deliveryId: request.data.deliveryId,
      deliveryKey: request.data.deliveryKey, exportPerformed: false as const,
      manifestDigest: request.data.manifestDigest,
      nativeOpenSessionReference: request.data.nativeOpenSessionReference,
      openedAt: request.data.openedAt, payloadDigest: request.data.payloadDigest,
      portalSessionId: request.data.portalSessionId,
      protocol: "sanduqkin:claim:native-open-proof:v1" as const,
      releasePackageId: request.data.releasePackageId,
      retrievalSessionId: request.data.retrievalSessionId };
    let proof: z.infer<typeof verifiedProofSchema>;
    try {
      const parsed = verifiedProofSchema.safeParse(await input.proofVerifier.verify({
        expected, proof: request.data.proof }));
      if (!parsed.success) verificationFailed(); proof = parsed.data;
    } catch (error) {
      if (error instanceof RetrievalCompletionServiceError) throw error;
      verificationFailed();
    }
    if (!matches(expected, proof)) verificationFailed();
    const nativeOpenSessionDigest = sha256(proof.nativeOpenSessionReference);
    const verifiedProofDigest = sha256([
      proof.protocol, proof.completionId, proof.deliveryId, proof.deliveryKey,
      proof.retrievalSessionId, proof.caseId, proof.releasePackageId, proof.portalSessionId,
      proof.claimantKeyId, proof.appAttestKeyIdDigest,
      String(proof.expectedPreviousCounter), String(proof.verifiedCounter), proof.bundleVersion,
      String(proof.validationCategory), proof.payloadDigest, proof.manifestDigest,
      nativeOpenSessionDigest, proof.openedAt, String(proof.exportPerformed),
    ].join("|"));
    try {
      return await input.transactions.complete({
        appAttestKeyIdDigest: proof.appAttestKeyIdDigest, bundleVersion: proof.bundleVersion,
        caseId: proof.caseId, claimantKeyId: proof.claimantKeyId,
        completionId: proof.completionId, deliveryId: proof.deliveryId,
        deliveryKey: proof.deliveryKey, expectedPreviousCounter: proof.expectedPreviousCounter,
        idempotencyKey: request.data.idempotencyKey, manifestDigest: proof.manifestDigest,
        nativeOpenSessionDigest, openedAt: proof.openedAt, payloadDigest: proof.payloadDigest,
        portalSessionId: proof.portalSessionId, releasePackageId: proof.releasePackageId,
        retrievalSessionId: proof.retrievalSessionId,
        validationCategory: proof.validationCategory, verifiedCounter: proof.verifiedCounter,
        verifiedProofDigest,
      });
    } catch { verificationFailed(); }
  } };
}

function matches(expected: z.infer<typeof expectedProofSchema>,
  proof: z.infer<typeof verifiedProofSchema>) {
  return expected.caseId === proof.caseId && expected.claimantKeyId === proof.claimantKeyId
    && expected.completionId === proof.completionId && expected.deliveryId === proof.deliveryId
    && expected.deliveryKey === proof.deliveryKey && expected.manifestDigest === proof.manifestDigest
    && expected.nativeOpenSessionReference === proof.nativeOpenSessionReference
    && expected.openedAt === proof.openedAt && expected.payloadDigest === proof.payloadDigest
    && expected.portalSessionId === proof.portalSessionId
    && expected.releasePackageId === proof.releasePackageId
    && expected.retrievalSessionId === proof.retrievalSessionId;
}
function canonicalTimestamp(value: string) { return new Date(value).toISOString(); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function verificationFailed(): never { throw new RetrievalCompletionServiceError("verification_failed"); }

const uuid = z.string().uuid(); const digest = z.string().regex(/^[0-9a-f]{64}$/u);
const expectedProofSchema = z.strictObject({ caseId: uuid, claimantKeyId: uuid, completionId: uuid,
  deliveryId: uuid, deliveryKey: z.string(), exportPerformed: z.literal(false), manifestDigest: digest,
  nativeOpenSessionReference: z.string(), openedAt: z.string(), payloadDigest: digest,
  portalSessionId: uuid, protocol: z.literal("sanduqkin:claim:native-open-proof:v1"),
  releasePackageId: uuid, retrievalSessionId: uuid });
const verifiedProofSchema = expectedProofSchema.extend({ appAttestKeyIdDigest: z.string()
  .regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u),
  bundleVersion: z.string().regex(/^[0-9]+(?:\.[0-9]+){0,2}$/u),
  expectedPreviousCounter: z.number().int().min(0).max(4_294_967_294),
  syntheticOnly: z.literal(true), validationCategory: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  verifiedCounter: z.number().int().min(1).max(4_294_967_295) }).superRefine((value, context) => {
    if (value.verifiedCounter <= value.expectedPreviousCounter) context.addIssue({
      code: "custom", message: "counter must advance" });
  });
const requestSchema = z.strictObject({ caseId: uuid, claimantKeyId: uuid, completionId: uuid,
  deliveryId: uuid, deliveryKey: z.string().regex(/^synthetic_package_delivery_[a-z0-9_]{1,100}$/u),
  idempotencyKey: uuid, manifestDigest: digest, nativeOpenSessionReference: z.string()
    .regex(/^claimant-package-open\.v1\.[0-9a-f-]{36}$/u),
  openedAt: z.string().datetime({ offset: true }), payloadDigest: digest, portalSessionId: uuid,
  proof: z.unknown(), releasePackageId: uuid, retrievalSessionId: uuid });
