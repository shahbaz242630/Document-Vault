const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes

export type FailedLoginTracker = {
  getRemainingLockoutMs: (email: string) => number;
  isLocked: (email: string) => boolean;
  recordFailure: (email: string) => void;
};

export function createFailedLoginTracker(): FailedLoginTracker {
  const attempts = new Map<string, number[]>();
  let lastObservedNow = Date.now();

  function getRemainingLockoutMs(email: string): number {
    const key = normalize(email);
    const list = attempts.get(key) ?? [];
    const now = Date.now();
    // Prevent system-clock backward manipulation from pruning old attempts
    // or shortening an active lockout.
    const effectiveNow = Math.max(now, lastObservedNow);
    lastObservedNow = effectiveNow;
    const recent = prune(list, effectiveNow);

    if (recent.length < MAX_ATTEMPTS) {
      return 0;
    }

    const lockedUntil = Math.max(...recent) + LOCKOUT_MS;
    return Math.max(0, lockedUntil - effectiveNow);
  }

  return {
    getRemainingLockoutMs,

    isLocked(email: string): boolean {
      return getRemainingLockoutMs(email) > 0;
    },

    recordFailure(email: string): void {
      const key = normalize(email);
      const now = Date.now();
      const effectiveNow = Math.max(now, lastObservedNow);
      lastObservedNow = effectiveNow;
      const list = attempts.get(key) ?? [];
      list.push(effectiveNow);
      attempts.set(key, prune(list, effectiveNow));
    },
  };
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function prune(list: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  return list.filter((timestamp) => timestamp >= cutoff);
}
