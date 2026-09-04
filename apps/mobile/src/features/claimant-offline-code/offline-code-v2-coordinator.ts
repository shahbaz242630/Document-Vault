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

type CoordinatorInput = Readonly<{
  approved?: boolean;
  claimantOrigin: string;
  transport: OfflineCodeV2Transport;
  producer: Readonly<{ produce(value: OfflineCodeV2ProofInput): Promise<OfflineCodePossessionProofV2> }>;
  now?: () => Date;
}>;
type CoordinatorState = {
  approved: boolean;
  origin: string;
  transport: OfflineCodeV2Transport;
  producer: CoordinatorInput["producer"];
  now: () => Date;
  active: AbortController | null;
  pending: OfflineCodeV2ProofRequest | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
  sends: number;
  lastTime: number;
};

// Pre-provisioned synthetic record material is supplied locally, never discovered from the challenge API.
export function createOfflineCodeV2Coordinator(input: CoordinatorInput) {
  const state: CoordinatorState = {
    approved: input.approved ?? CLAIMANT_OFFLINE_CODE_V2_CLIENT_COORDINATOR_APPROVED,
    origin: input.claimantOrigin,
    transport: input.transport,
    producer: input.producer,
    now: input.now ?? (() => new Date()),
    active: null,
    pending: null,
    expiryTimer: null,
    sends: 0,
    lastTime: -Infinity,
  };
  return {
    start: (value: OfflineCodeV2SyntheticAttempt) => startAttempt(state, value),
    retryProof: () => retryProof(state),
    cancel: () => cancel(state),
  };
}

function clearPending(state: CoordinatorState): void {
  state.pending = null;
  if (state.expiryTimer !== null) clearTimeout(state.expiryTimer);
  state.expiryTimer = null;
}

function time(state: CoordinatorState, challenge?: OfflineCodeChallengeV2): Date {
  const current = new Date(state.now().getTime());
  const timestamp = current.getTime();
  if (!Number.isFinite(timestamp) || timestamp < state.lastTime) throw new Error();
  state.lastTime = timestamp;
  if (challenge && (timestamp < Date.parse(challenge.issued_at)
    || timestamp >= Date.parse(challenge.expires_at))) throw new Error();
  return current;
}

function checkpoint(state: CoordinatorState, controller: AbortController,
  challenge?: OfflineCodeChallengeV2): void {
  if (controller.signal.aborted || state.active !== controller) throw new Error();
  time(state, challenge);
}

function enter(state: CoordinatorState): AbortController {
  if (!state.approved || state.active) throw new OfflineCodeV2UnavailableError();
  assertOfflineCodeV2Origin(state.origin);
  const controller = new AbortController();
  state.active = controller;
  return controller;
}

async function sendProof(state: CoordinatorState,
  controller: AbortController): Promise<OfflineCodeV2PossessionResult> {
  try {
    if (!state.pending || state.sends >= MAX_PROOF_SENDS) throw new Error();
    checkpoint(state, controller, state.pending.challenge);
    const request = state.pending;
    state.sends += 1;
    const raw = await state.transport.verifyProof({ ...request, signal: controller.signal });
    checkpoint(state, controller, request.challenge);
    const result = validateOfflineCodeV2PossessionResult(raw);
    clearPending(state);
    return result;
  } catch (error) {
    // Only ambiguous delivery failures retain the exact public proof request, never client secret material.
    if (controller.signal.aborted || !(error instanceof OfflineCodeV2UnavailableError)
      || !error.retryable || state.sends >= MAX_PROOF_SENDS) clearPending(state);
    throw new OfflineCodeV2UnavailableError();
  }
}

async function startAttempt(state: CoordinatorState,
  value: OfflineCodeV2SyntheticAttempt): Promise<OfflineCodeV2PossessionResult> {
  let controller: AbortController | null = null;
  let material: Omit<OfflineCodeV2ProofInput, "challenge" | "expectedOrigin" | "now"> | null = null;
  let proofDispatched = false;
  try {
    if (state.pending) throw new Error();
    controller = enter(state);
    checkpoint(state, controller);
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
    const issued = validateOfflineCodeV2IssuedChallenge(await state.transport.issueChallenge({
      locator: material.publicLocator.locator, idempotencyKey: challengeKey, signal: controller.signal,
    }), state.origin);
    checkpoint(state, controller, issued.challenge);
    if (canonicalJson(issued.kdfProfile as never) !== canonicalJson(material.kdfProfile as never)) throw new Error();
    for (const field of ["locator_record_id", "locator_version", "locator_commitment",
      "proof_key_version", "proof_public_key"] as const) {
      if (issued.challenge[field] !== material.recordBinding[field]) throw new Error();
    }
    const proof = await state.producer.produce({ ...material, challenge: issued.challenge,
      expectedOrigin: state.origin, now: () => time(state, issued.challenge) });
    material = null;
    checkpoint(state, controller, issued.challenge);
    const remaining = Date.parse(issued.challenge.expires_at) - time(state, issued.challenge).getTime();
    state.pending = validateOfflineCodeV2ProofRequest({ challenge: issued.challenge,
      challengeBytesBase64url: issued.challengeBytesBase64url,
      possessionProof: proof, idempotencyKey: proofKey }, state.origin);
    state.expiryTimer = setTimeout(() => { clearPending(state); state.active?.abort(); }, Math.max(0, remaining));
    state.sends = 0;
    proofDispatched = true;
    return await sendProof(state, controller);
  } catch {
    if (controller && !proofDispatched) clearPending(state);
    throw new OfflineCodeV2UnavailableError();
  } finally {
    material = null;
    if (controller) { controller.abort(); state.active = null; }
  }
}

async function retryProof(state: CoordinatorState): Promise<OfflineCodeV2PossessionResult> {
  let controller: AbortController | null = null;
  try { controller = enter(state); return await sendProof(state, controller); }
  catch { throw new OfflineCodeV2UnavailableError(); }
  finally { if (controller) { controller.abort(); state.active = null; } }
}

function cancel(state: CoordinatorState): void {
  clearPending(state);
  state.active?.abort();
}
