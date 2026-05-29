import { describe, expect, it } from "vitest";

import { createReAuthViewModel } from "./re-auth-view-model";

describe("createReAuthViewModel", () => {
  it("returns re-authentication screen copy", () => {
    const vm = createReAuthViewModel();

    expect(vm.title).toBe("Verify your identity");
    expect(vm.subtitle).toContain("Re-authentication is required");
    expect(vm.primaryActionLabel).toBe("Verify");
    expect(vm.emailLabel).toBe("Email");
    expect(vm.passwordLabel).toBe("Password");
    expect(vm.totpLabel).toBe("Two-factor code");
    expect(vm.bypassLabel).toContain("Skip re-authentication");
  });
});
