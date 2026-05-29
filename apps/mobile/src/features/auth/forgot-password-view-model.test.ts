import { describe, expect, it } from "vitest";

import { createForgotPasswordViewModel } from "./forgot-password-view-model";

describe("createForgotPasswordViewModel", () => {
  it("returns forgot password screen copy", () => {
    const vm = createForgotPasswordViewModel();

    expect(vm.title).toBe("Forgot your password?");
    expect(vm.recoverWithPhraseLabel).toContain("recovery phrase");
    expect(vm.resetWithoutDataLabel).toContain("don't have");
  });
});
