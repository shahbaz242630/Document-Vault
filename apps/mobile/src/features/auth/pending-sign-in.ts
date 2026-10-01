/*
 * Between the password step and the TOTP step, the vault unlock waits here so the vault opens only after the second
 * factor passes. It lives in memory only (never stored or routed), expires after ten minutes and is taken once.
 */
export const PENDING_SIGN_IN_TTL_MS = 10 * 60_000;

type PendingSignIn = { expiresAt: number; unlock: () => Promise<void> };

let pending: PendingSignIn | null = null;

export function holdPendingSignIn(unlock: () => Promise<void>, now = Date.now()): void {
  pending = { expiresAt: now + PENDING_SIGN_IN_TTL_MS, unlock };
}

/** Returns the waiting unlock once, or null when there is none or it has expired. */
export function takePendingSignIn(now = Date.now()): (() => Promise<void>) | null {
  const current = pending;
  pending = null;
  return current && current.expiresAt > now ? current.unlock : null;
}

export function clearPendingSignIn(): void {
  pending = null;
}
