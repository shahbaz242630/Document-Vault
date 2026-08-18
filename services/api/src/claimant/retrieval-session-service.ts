import { z } from "zod";

import type { ClaimantPortalSessionClient } from "./portal-session-client.js";
import type { RetrievalSessionTransactionClientV1 }
  from "./retrieval-session-transaction-client.js";
import { ClaimantAssuranceError, requireFreshClaimantAssurance }
  from "./session-assurance.js";

export const CLAIMANT_RETRIEVAL_SESSION_APPROVED = false as const;

export class RetrievalSessionServiceError extends Error {
  constructor(readonly kind: "disabled" | "invalid_input" | "unauthorized") {
    super("Claimant retrieval session authorization is unavailable.");
    this.name = "RetrievalSessionServiceError";
  }
}

export function createRetrievalSessionServiceV1(input: Readonly<{
  approved?: boolean;
  freshAssuranceSeconds?: number;
  nowEpochSeconds?: () => number;
  sessions: Pick<ClaimantPortalSessionClient, "getSession">;
  transactions: RetrievalSessionTransactionClientV1;
}>) {
  return { async authorize(value: unknown) {
    if (!(input.approved ?? CLAIMANT_RETRIEVAL_SESSION_APPROVED)) {
      throw new RetrievalSessionServiceError("disabled");
    }
    const parsed = requestSchema.safeParse(value);
    if (!parsed.success) throw new RetrievalSessionServiceError("invalid_input");
    let session;
    try {
      session = await input.sessions.getSession(parsed.data.bearerToken);
    } catch {
      throw new RetrievalSessionServiceError("unauthorized");
    }
    let assurance;
    try {
      assurance = requireFreshClaimantAssurance(session,
        (input.nowEpochSeconds ?? (() => Math.floor(Date.now() / 1000)))(),
        input.freshAssuranceSeconds ?? 600);
    } catch (error) {
      if (error instanceof ClaimantAssuranceError) {
        throw new RetrievalSessionServiceError("unauthorized");
      }
      throw error;
    }
    return input.transactions.authorize({ authenticatedAt: assurance.authenticatedAt,
      caseId: parsed.data.caseId, claimantUserId: session.userId,
      expectedCaseVersion: parsed.data.expectedCaseVersion,
      finalizationId: parsed.data.finalizationId, grantId: parsed.data.grantId,
      idempotencyKey: parsed.data.idempotencyKey, packageId: parsed.data.packageId,
      portalSessionId: session.sessionId, recipientKeyId: parsed.data.recipientKeyId,
      retrievalSessionId: parsed.data.retrievalSessionId });
  } };
}

const uuid = z.string().uuid();
const requestSchema = z.strictObject({
  bearerToken: z.string().min(32).max(8192), caseId: uuid,
  expectedCaseVersion: z.number().int().min(4), finalizationId: uuid,
  grantId: uuid, idempotencyKey: uuid, packageId: uuid,
  recipientKeyId: uuid, retrievalSessionId: uuid,
});
