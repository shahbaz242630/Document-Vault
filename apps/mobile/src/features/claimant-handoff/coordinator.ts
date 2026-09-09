import { attemptSchema, completionSchema, HandoffUnavailableError, signatureSchema,
  validateSession, validateTranscript, type HandoffAttempt, type HandoffSession } from "./contracts";
import { abortable, type HandoffTransport } from "./transport";

export const CLAIMANT_HANDOFF_COORDINATOR_APPROVED = false as const;
const MAX_COMPLETION_SENDS = 3;
const OPERATION_TIMEOUT_MS = 30_000;
type Binding = Pick<HandoffSession, "userId" | "sessionId" | "sessionVersion">;
type Pending = Readonly<{ binding: Binding; handoffId: string; caseId: string;
  expiresAt: number; signature: string; idempotencyKey: string }>;
type Input = Readonly<{
  approved?: boolean; transport: HandoffTransport; now?: () => number;
  getSession: () => unknown;
  signer: Readonly<{ syntheticOnly: true;
    sign: (value: Readonly<{ transcriptBytesBase64url: string; challengeId: string;
      recordBindingDigest: string; signal: AbortSignal }>) => Promise<string> }>;
}>;

// A caller supplies synthetic possession context; server verification remains authoritative.
// No client secret, native key, bearer, or transcript is retained for retry.
export function createHandoffCoordinator(input: Input) {
  const approved = input.approved ?? CLAIMANT_HANDOFF_COORDINATOR_APPROVED;
  const { transport, signer, getSession } = input;
  const clock = input.now ?? Date.now;
  let active: AbortController | null = null;
  let pending: Pending | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let sends = 0; let lastTime = -Infinity;
  function clear() {
    pending = null;
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    expiryTimer = null;
  }
  function now() {
    const time = clock();
    if (!Number.isFinite(time) || time < lastTime) throw new HandoffUnavailableError();
    lastTime = time; return time;
  }
  function checkpoint(controller: AbortController, binding?: Binding): HandoffSession {
    if (active !== controller || controller.signal.aborted) throw new HandoffUnavailableError();
    const session = validateSession(getSession(), now());
    if (binding && (binding.userId !== session.userId || binding.sessionId !== session.sessionId
      || binding.sessionVersion !== session.sessionVersion)) throw new HandoffUnavailableError();
    return session;
  }
  async function run<T>(operation: (controller: AbortController) => Promise<T>): Promise<T> {
    if (!approved || active) throw new HandoffUnavailableError();
    const controller = new AbortController(); active = controller;
    const timer = setTimeout(() => controller.abort(), OPERATION_TIMEOUT_MS);
    try { return await operation(controller); }
    catch (error) {
      if (!(error instanceof HandoffUnavailableError) || !error.retryable
        || controller.signal.aborted) clear();
      throw new HandoffUnavailableError();
    } finally {
      clearTimeout(timer); controller.abort();
      if (active === controller) active = null;
    }
  }
  async function sendCompletion(controller: AbortController) {
    if (!pending || sends >= MAX_COMPLETION_SENDS) throw new HandoffUnavailableError();
    const request = pending;
    const session = checkpoint(controller, request.binding);
    if (now() >= request.expiresAt) throw new HandoffUnavailableError();
    sends += 1;
    try {
      const raw = await abortable(transport.complete({ handoffId: request.handoffId,
        signature: request.signature, idempotencyKey: request.idempotencyKey,
        accessToken: session.accessToken, signal: controller.signal }), controller.signal);
      checkpoint(controller, request.binding);
      if (now() >= request.expiresAt) throw new HandoffUnavailableError();
      const result = completionSchema.parse(raw);
      if (result.case_id !== request.caseId) throw new HandoffUnavailableError();
      clear(); return Object.freeze(result);
    } catch (error) {
      // Retain only the exact signed completion after an ambiguous delivery failure.
      checkpoint(controller, request.binding);
      if (now() >= request.expiresAt || sends >= MAX_COMPLETION_SENDS) clear();
      throw error;
    }
  }
  return {
    start(value: HandoffAttempt) {
      // Do not discard another in-flight attempt or an ambiguous completion.
      if (pending) return Promise.reject(new HandoffUnavailableError());
      return run(async (controller) => {
        if (signer.syntheticOnly !== true) throw new HandoffUnavailableError();
        const attempt = attemptSchema.parse(value);
        if (attempt.issueIdempotencyKey === attempt.completionIdempotencyKey) throw new HandoffUnavailableError();
        const session = checkpoint(controller);
        const binding = Object.freeze({ userId: session.userId, sessionId: session.sessionId,
          sessionVersion: session.sessionVersion });
        const raw = await abortable(transport.issue({ challengeId: attempt.challengeId,
          idempotencyKey: attempt.issueIdempotencyKey, accessToken: session.accessToken,
          signal: controller.signal }), controller.signal);
        checkpoint(controller, binding);
        const validated = validateTranscript(raw, attempt, session, now());
        const signature = signatureSchema.parse(await abortable(signer.sign({
          transcriptBytesBase64url: validated.issued.transcript_bytes_base64url,
          challengeId: attempt.challengeId, recordBindingDigest: attempt.recordBindingDigest,
          signal: controller.signal,
        }), controller.signal));
        checkpoint(controller, binding);
        if (now() >= validated.expiresAt) throw new HandoffUnavailableError();
        pending = Object.freeze({ binding, handoffId: validated.issued.handoff_id, caseId: validated.caseId,
          expiresAt: validated.expiresAt, signature, idempotencyKey: attempt.completionIdempotencyKey });
        sends = 0;
        expiryTimer = setTimeout(() => { clear(); active?.abort(); }, validated.expiresAt - now());
        return sendCompletion(controller);
      });
    },
    retryCompletion: () => run(sendCompletion),
    cancel() { clear(); active?.abort(); },
  };
}
