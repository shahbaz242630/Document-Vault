import { describe, expect, it } from "vitest";

import { createReAuthViewModel } from "./re-auth-view-model";

describe("createReAuthViewModel", () => {
  it("returns re-authentication screen copy", () => {
    const vm = createReAuthViewModel();

    expect(vm.title).toBe("Confirm it's you");
    expect(vm.subtitle).toContain("we double-check before opening it");
    expect(vm.primaryActionLabel).toBe("Verify");
    expect(vm.emailLabel).toBe("Email");
    expect(vm.passwordLabel).toBe("Password");
    expect(vm.totpLabel).toBe("Two-factor code");
    expect(vm.bypassLabel).toContain("Skip re-authentication");
  });
});
