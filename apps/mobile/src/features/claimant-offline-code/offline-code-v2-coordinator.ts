import {
  assertOfflineCodeClientSecretV2,
  assertOfflineCodeKdfProfileV2,
  assertOfflineCodePublicLocatorV2,
  assertOfflineCodeRecordBindingV2,
  canonicalJson,
  type OfflineCodeChallengeV2,
  type OfflineCodePossessionProofV2,
} from "@vault/shared-types";

import type { OfflineCodeV2ProofInput } from "./offline-code-v2-proof-core";
import {
  assertOfflineCodeV2IdempotencyKey,
  assertOfflineCodeV2Origin,
  OfflineCodeV2UnavailableError,
  validateOfflineCodeV2IssuedChallenge,
  validateOfflineCodeV2PossessionResult,
  validateOfflineCodeV2ProofRequest,
  type OfflineCodeV2PossessionResult,
  type OfflineCodeV2ProofRequest,
  type OfflineCodeV2Transport,
} from "./offline-code-v2-transport";

export const CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED = false as const;
const MAX_PROOF_SENDS = 3;

export type OfflineCodeV2SyntheticAttempt = Omit<OfflineCodeV2ProofInput, "challenge" | "expectedOrigin" | "now"> & Readonly<{
  syntheticOnly: true;
  challengeIdempotencyKey: string;
  proofIdempotencyKey: string;
}>;

// Pre-provisioned synthetic record material is supplied locally, never discovered from the challenge API.
export function createOfflineCodeV2Coordinator(input: Readonly<{
  approved?: boolean;
  claimantOrigin: string;
  transport: OfflineCodeV2Transport;
  producer: Readonly<{ produce(value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> }>;
  now?: () => Date;
}>) {
  const approved = input.approved ?? CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED;
  const origin = input.claimantOrigin;
  const transport = input.transport;
  const producer = input.producer;
  const now = input.now ?? (() => new Date());
  let active: AbortController | null = null;
  let pending: OfflineCodeV2ProofRequest | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let sends = 0;
  let lastTime = -Infinity;

  function clearPending(): void {
    pending = null;
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  function time(challenge?: OfflineCodeChallengeV2): Date {
    const current = new Date(now().getTime());
    const timestamp = current.getTime();
    if (!Number.isFinite(timestamp) || timestamp < lastTime) throw new Error();
    lastTime = timestamp;
    if (challenge && (timestamp < Date.parse(challenge.issued_at)
      || timestamp >= Date.parse(challenge.expires_at))) throw new Error();
    return current;
  }
  function checkpoint(controller: AbortController, challenge?: OfflineCodeChallengeV2): void {
    if (controller.signal.aborted || active !== controller) throw new Error();
    time(challenge);
  }
  function enter(): AbortController {
    if (!approved || active) throw new OfflineCodeV2UnavailableError();
    assertOfflineCodeV2Origin(origin);
    const controller = new AbortController();
    active = controller;
    return controller;
  }
  async function sendProof(controller: AbortController): Promise<OfflineCodeV2PossessionResult> {
    try {
      if (!pending || sends >= MAX_PROOF_SENDS) throw new Error();
      checkpoint(controller, pending.challenge);
      const request = pending;
      sends += 1;
      const raw = await transport.verifyProof({ ...request, signal: controller.signal });
      checkpoint(controller, request.challenge);
      const result = validateOfflineCodeV2PossessionResult(raw);
      clearPending();
      return result;
    } catch (error) {
      // Only ambiguous delivery failures retain the exact public proof request, never client secret material.
      if (controller.signal.aborted || !(error instanceof OfflineCodeV2UnavailableError)
        || !error.retryable || sends >= MAX_PROOF_SENDS) clearPending();
      throw new OfflineCodeV2UnavailableError();
    }
  }
  return {
    async start(value: OfflineCodeV2SyntheticAttempt): Promise<OfflineCodeV2PossessionResult> {
      let controller: AbortController | null = null;
      let material: Omit<OfflineCodeV2ProofInput, "challenge" | "expectedOrigin" | "now"> | null = null;
      let proofDispatched = false;
      try {
        if (pending) throw new Error();
        controller = enter();
        checkpoint(controller);
        if (value.syntheticOnly !== true) throw new Error();
        assertOfflineCodeV2IdempotencyKey(value.challengeIdempotencyKey);
        assertOfflineCodeV2IdempotencyKey(value.proofIdempotencyKey);
        if (value.challengeIdempotencyKey === value.proofIdempotencyKey) throw new Error();
        const challengeKey = value.challengeIdempotencyKey;
        const proofKey = value.proofIdempotencyKey;
        assertOfflineCodeKdfProfileV2(value.kdfProfile);
        material = Object.freeze({ publicLocator: Object.freeze({ ...assertOfflineCodePublicLocatorV2(value.publicLocator) }),
          clientSecret: Object.freeze({ ...assertOfflineCodeClientSecretV2(value.clientSecret) }),
          kdfProfile: Object.freeze({ ...value.kdfProfile }),
          recordBinding: Object.freeze({ ...assertOfflineCodeRecordBindingV2(value.recordBinding) }) });
        if (material.recordBinding.kdf_profile_id !== material.kdfProfile.profile_id
          || material.recordBinding.locator_version !== 2 || material.recordBinding.proof_key_version !== 1) throw new Error();
        const issued = validateOfflineCodeV2IssuedChallenge(await transport.issueChallenge({
          locator: material.publicLocator.locator, idempotencyKey: challengeKey, signal: controller.signal,
        }), origin);
        checkpoint(controller, issued.challenge);
        if (canonicalJson(issued.kdfProfile as never) !== canonicalJson(material.kdfProfile as never)) throw new Error();
        for (const field of ["locator_record_id", "locator_version", "locator_commitment",
          "proof_key_version", "proof_public_key"] as const) {
          if (issued.challenge[field] !== material.recordBinding[field]) throw new Error();
        }
        const proof = await producer.produce({ ...material, challenge: issued.challenge,
          expectedOrigin: origin, now: () => time(issued.challenge) });
        material = null;
        checkpoint(controller, issued.challenge);
        const remaining = Date.parse(issued.challenge.expires_at) - time(issued.challenge).getTime();
        pending = validateOfflineCodeV2ProofRequest({ challenge: issued.challenge,
          challengeBytesBase64url: issued.challengeBytesBase64url,
          possessionProof: proof, idempotencyKey: proofKey }, origin);
        expiryTimer = setTimeout(() => { clearPending(); active?.abort(); }, Math.max(0, remaining));
        sends = 0;
        proofDispatched = true;
        return await sendProof(controller);
      } catch {
        if (controller && !proofDispatched) clearPending();
        throw new OfflineCodeV2UnavailableError();
      }
      finally {
        material = null;
        if (controller) { controller.abort(); active = null; }
      }
    },
    async retryProof(): Promise<OfflineCodeV2PossessionResult> {
      let controller: AbortController | null = null;
      try { controller = enter(); return await sendProof(controller); }
      catch { throw new OfflineCodeV2UnavailableError(); }
      finally { if (controller) { controller.abort(); active = null; } }
    },
    cancel(): void {
      clearPending();
      active?.abort();
    },
  };
}
