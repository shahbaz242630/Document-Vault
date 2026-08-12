import { createNativeEnrollmentAttemptStoreV1,
  type NativeEnrollmentAttemptSecureStorageV1 } from "./native-enrollment-attempt-store";
import { createEnrollmentAppAttestAdapterV1, createEnrollmentCustodyAdapterV1,
  type ClaimantEnrollmentNativeV1 } from "./native-enrollment-adapters";
import { createNativeEnrollmentCoordinatorV1 } from "./native-enrollment-coordinator";
import { digestNativeEnrollmentRequestV1 } from "./native-enrollment-request-digest";
import { createNativeEnrollmentTransportV1 } from "./native-enrollment-transport";

export const CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED = false as const;

export class NativeEnrollmentRuntimeError extends Error {
  constructor(readonly kind: "busy" | "disabled") {
    super("Native enrollment is unavailable."); this.name = "NativeEnrollmentRuntimeError";
  }
}

export function createNativeEnrollmentRuntimeV1(input: Readonly<{
  accountId: string;
  apiBaseUrl: string;
  approved?: boolean;
  createIdempotencyKey: () => string;
  fetch?: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  native: ClaimantEnrollmentNativeV1 | null;
  storage: NativeEnrollmentAttemptSecureStorageV1 | null;
}>) {
  const approved = input.approved ?? CLAIMANT_NATIVE_ENROLLMENT_RUNTIME_APPROVED;
  const coordinator = approved ? createNativeEnrollmentCoordinatorV1({
    appAttest: createEnrollmentAppAttestAdapterV1({ approved: true, native: input.native }), approved: true,
    attemptPersistence: { accountId: input.accountId, approved: true,
      createAttemptId: input.createIdempotencyKey, digestRequest: digestNativeEnrollmentRequestV1,
      store: createNativeEnrollmentAttemptStoreV1({ approved: true, storage: input.storage }) },
    createIdempotencyKey: input.createIdempotencyKey,
    custody: createEnrollmentCustodyAdapterV1({ approved: true, native: input.native }),
    transport: createNativeEnrollmentTransportV1({ apiBaseUrl: input.apiBaseUrl,
      fetch: input.fetch, getAccessToken: input.getAccessToken }),
  }) : null;
  let active: Readonly<{ controller: AbortController; promise: Promise<unknown> }> | null = null;

  const run = <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (!approved || !coordinator) throw new NativeEnrollmentRuntimeError("disabled");
    if (active) throw new NativeEnrollmentRuntimeError("busy");
    const controller = new AbortController();
    const promise = operation(controller.signal).finally(() => { if (active?.promise === promise) active = null; });
    active = { controller, promise }; return promise;
  };

  return {
    enroll: async (invitationReference: string) => run((signal) => coordinator!.enroll(invitationReference, signal)),
    recover: async () => run((signal) => coordinator!.recover(signal)),
    async settleBeforeSessionEnd() {
      requireApproved(approved); const inFlight = active; inFlight?.controller.abort();
      try { await inFlight?.promise; } catch { /* recovery below owns the safe terminal decision */ }
      return run((signal) => coordinator!.recover(signal));
    },
    cancel() { requireApproved(approved); active?.controller.abort(); },
  };
}

function requireApproved(approved: boolean): void {
  if (!approved) throw new NativeEnrollmentRuntimeError("disabled");
}
