import { describe, expect, it, vi } from "vitest";

import { createFailedLoginTracker } from "./failed-login-tracker";

describe("createFailedLoginTracker", () => {
  it("returns no lockout when there are no failures", () => {
    const tracker = createFailedLoginTracker();

    expect(tracker.isLocked("partner@example.com")).toBe(false);
    expect(tracker.getRemainingLockoutMs("partner@example.com")).toBe(0);
  });

  it("returns no lockout after 4 failures", () => {
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 4; i++) {
      tracker.recordFailure("partner@example.com");
    }

    expect(tracker.isLocked("partner@example.com")).toBe(false);
  });

  it("locks after 5 failures within the window", () => {
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure("partner@example.com");
    }

    expect(tracker.isLocked("partner@example.com")).toBe(true);
    expect(tracker.getRemainingLockoutMs("partner@example.com")).toBeGreaterThan(0);
  });

  it("does not lock a different email when one email fails", () => {
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure("partner@example.com");
    }

    expect(tracker.isLocked("other@example.com")).toBe(false);
  });

  it("clears the lockout after 30 minutes", () => {
    vi.useFakeTimers();
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure("partner@example.com");
    }

    expect(tracker.isLocked("partner@example.com")).toBe(true);

    vi.advanceTimersByTime(30 * 60 * 1000 + 1);

    expect(tracker.isLocked("partner@example.com")).toBe(false);
    expect(tracker.getRemainingLockoutMs("partner@example.com")).toBe(0);

    vi.useRealTimers();
  });

  it("ignores failures older than 15 minutes for the threshold", () => {
    vi.useFakeTimers();
    const base = Date.now();

    // Start in the past so old failures fall outside the 15-min window
    // when we reach the present.
    vi.setSystemTime(base - 20 * 60 * 1000);
    const tracker = createFailedLoginTracker();

    // 4 old failures
    for (let i = 0; i < 4; i++) {
      tracker.recordFailure("partner@example.com");
      vi.advanceTimersByTime(1000);
    }

    // Jump forward to the present
    vi.setSystemTime(base);

    // 4 recent failures
    for (let i = 0; i < 4; i++) {
      tracker.recordFailure("partner@example.com");
      vi.advanceTimersByTime(1000);
    }

    expect(tracker.isLocked("partner@example.com")).toBe(false);

    vi.useRealTimers();
  });

  it("normalizes email case and whitespace", () => {
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure("  Partner@Example.COM  ");
    }

    expect(tracker.isLocked("partner@example.com")).toBe(true);
  });

  it("does not clear the lockout when the system clock moves backward", () => {
    vi.useFakeTimers();
    const tracker = createFailedLoginTracker();

    for (let i = 0; i < 5; i++) {
      tracker.recordFailure("partner@example.com");
    }

    expect(tracker.isLocked("partner@example.com")).toBe(true);

    // Move the system clock backward by 10 minutes.
    vi.setSystemTime(Date.now() - 10 * 60 * 1000);

    // Should still be locked; backward clock must not prune attempts.
    expect(tracker.isLocked("partner@example.com")).toBe(true);
    expect(tracker.getRemainingLockoutMs("partner@example.com")).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});
