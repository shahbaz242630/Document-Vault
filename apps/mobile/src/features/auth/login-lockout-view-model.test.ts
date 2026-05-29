import { describe, expect, it } from "vitest";

import { createLoginLockoutViewModel } from "./login-lockout-view-model";

describe("createLoginLockoutViewModel", () => {
  it("formats 1 minute for any remaining time under 60 seconds", () => {
    const vm = createLoginLockoutViewModel(30_000);

    expect(vm.message).toBe("Too many failed attempts. Please try again in 1 minute.");
  });

  it("formats plural minutes for remaining time over 1 minute", () => {
    const vm = createLoginLockoutViewModel(150_000);

    expect(vm.message).toBe("Too many failed attempts. Please try again in 3 minutes.");
  });

  it("formats exactly 1 minute", () => {
    const vm = createLoginLockoutViewModel(60_000);

    expect(vm.message).toBe("Too many failed attempts. Please try again in 1 minute.");
  });
});
