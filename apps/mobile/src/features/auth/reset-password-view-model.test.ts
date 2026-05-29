import { describe, expect, it } from "vitest";

import { createResetPasswordViewModel } from "./reset-password-view-model";

describe("createResetPasswordViewModel", () => {
  it("returns reset password screen copy", () => {
    const vm = createResetPasswordViewModel();

    expect(vm.recoverTitle).toBe("Recover your vault");
    expect(vm.freshTitle).toBe("Reset account");
    expect(vm.phraseInputLabel).toBe("Recovery phrase");
    expect(vm.newPasswordLabel).toBe("New password");
  });
});
