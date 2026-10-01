import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearPendingSignIn,
  holdPendingSignIn,
  PENDING_SIGN_IN_TTL_MS,
  takePendingSignIn,
} from "./pending-sign-in";

describe("pending sign-in", () => {
  afterEach(() => clearPendingSignIn());

  it("hands the waiting vault unlock over exactly once", () => {
    const unlock = vi.fn(async () => undefined);
    holdPendingSignIn(unlock, 1_000);
    expect(takePendingSignIn(1_001)).toBe(unlock);
    expect(takePendingSignIn(1_002)).toBeNull();
  });

  it("drops an unlock that has waited ten minutes or more, and on clear", () => {
    holdPendingSignIn(async () => undefined, 0);
    expect(takePendingSignIn(PENDING_SIGN_IN_TTL_MS)).toBeNull();
    holdPendingSignIn(async () => undefined, 0);
    clearPendingSignIn();
    expect(takePendingSignIn(1)).toBeNull();
  });

  it("keeps only the latest sign-in", () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    holdPendingSignIn(first, 0);
    holdPendingSignIn(second, 0);
    expect(takePendingSignIn(1)).toBe(second);
  });
});
