import { parseOfflineCodeSheetV2, type OfflineCodeSheetV2 } from "@vault/shared-types";

export type SheetCheckStatus = "unavailable" | "ready" | "checking" | "valid" | "unusable" | "failed";
export type SheetCheckAttempt = OfflineCodeSheetV2 & Readonly<{ syntheticOnly: true; challengeIdempotencyKey: string;
  proofIdempotencyKey: string }>;

/**
 * What the runtime saw of one check, as flags only (never a value): the challenge was issued, the device began the
 * proof, the proof failed on the device, the server refused the proof, or the network or server failed.
 */
export type SheetCheckSeen = { issued: boolean; proving: boolean; proofFailed: boolean; rejected: boolean;
  faulted: boolean };

/** One possession check through the offline-code V2 client: challenge, on-device proof, proof submit. */
export type SheetCheckPort = Readonly<{
  start(attempt: SheetCheckAttempt, seen: SheetCheckSeen): Promise<unknown>;
  cancel(): void;
  dispose(): unknown;
}>;

/*
 * A revoked, expired or unknown sheet gets a decoy challenge that does not match the sheet, so the device never
 * starts the proof; a proof the server refuses means the same. Anything else that stops the check is retryable.
 */
export function classifySheetCheck(verified: boolean, seen: SheetCheckSeen): "valid" | "unusable" | "failed" {
  if (verified) return "valid";
  if (seen.faulted || seen.proofFailed) return "failed";
  return seen.rejected || (seen.issued && !seen.proving) ? "unusable" : "failed";
}

function isAsserted(value: unknown): boolean {
  return !!value && typeof value === "object" && (value as Record<string, unknown>).route_possession_asserted === true
    && (value as Record<string, unknown>).claim_created === false;
}

const snapshotOf = (status: SheetCheckStatus) => Object.freeze({ status });
export type SheetCheckSnapshot = ReturnType<typeof snapshotOf>;

/** Staging wiring W2a: check one scanned sheet and keep only the outcome. No claim is started. */
export function createSheetCheckFlow(input: Readonly<{ port: SheetCheckPort | null; newKey: () => string }>) {
  let status: SheetCheckStatus = input.port ? "ready" : "unavailable";
  let disposed = false;
  let generation = 0;
  const listeners = new Set<(snapshot: SheetCheckSnapshot) => void>();

  const set = (next: SheetCheckStatus) => {
    if (disposed) return;
    status = next;
    const snapshot = snapshotOf(status);
    for (const listener of listeners) {
      try { listener(snapshot); } catch { /* A screen listener cannot change the check. */ }
    }
  };

  async function submit(sheetText: string): Promise<void> {
    const port = input.port;
    if (!port || disposed || status !== "ready") return;
    const started = ++generation;
    set("checking");
    let attempt: SheetCheckAttempt | null;
    try {
      attempt = { ...parseOfflineCodeSheetV2(sheetText), syntheticOnly: true, challengeIdempotencyKey: input.newKey(),
        proofIdempotencyKey: input.newKey() };
    } catch { set("unusable"); return; }
    const seen: SheetCheckSeen = { issued: false, proving: false, proofFailed: false, rejected: false, faulted: false };
    let verified = false;
    try { verified = isAsserted(await port.start(attempt, seen)); }
    catch { port.cancel(); }
    finally { attempt = null; }
    if (disposed || generation !== started) return;
    set(classifySheetCheck(verified, seen));
  }

  return Object.freeze({
    submit,
    snapshot: () => snapshotOf(status),
    subscribe(listener: (snapshot: SheetCheckSnapshot) => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    /** Stops any check in flight and returns to scanning; also "Try again" and "Check another sheet". */
    reset() {
      if (disposed || !input.port) return;
      generation += 1;
      input.port.cancel();
      set("ready");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      listeners.clear();
      input.port?.cancel();
      void Promise.resolve(input.port?.dispose()).catch(() => undefined);
    },
  });
}

export type SheetCheckFlow = ReturnType<typeof createSheetCheckFlow>;

export type SheetCheckView = Readonly<{
  title: string;
  body: string;
  notice: Readonly<{ variant: "success" | "danger"; title: string; message: string }> | null;
  scanLabel: string | null;
  resetLabel: string | null;
}>;

const title = "Check an emergency sheet";
const again = "Check another sheet";

export function sheetCheckView(status: SheetCheckStatus): SheetCheckView {
  switch (status) {
    case "unavailable":
      return { title, body: "Checking an emergency sheet isn't available in this app.", notice: null, scanLabel: null,
        resetLabel: null };
    case "ready":
      return { title, body: "Scan the QR code on a printed emergency sheet to check it. No claim is started and "
        + "nothing about the sheet is kept.", notice: null, scanLabel: "Scan the QR code", resetLabel: null };
    case "checking":
      return { title, body: "Checking the sheet securely. Keep the app open.", notice: null, scanLabel: null,
        resetLabel: "Cancel" };
    case "valid":
      return { title, body: "No claim was started.", scanLabel: null, resetLabel: again,
        notice: { variant: "success", title: "This sheet is valid", message: "It can be used to start a claim." } };
    case "unusable":
      return { title, body: "No claim was started.", scanLabel: null, resetLabel: again,
        notice: { variant: "danger", title: "This sheet can't be used",
          message: "It may have been revoked or replaced, or it has expired." } };
    case "failed":
      return { title, body: "No claim was started.", scanLabel: null, resetLabel: "Try again",
        notice: { variant: "danger", title: "Something went wrong, try again",
          message: "The sheet could not be checked just now." } };
  }
}
