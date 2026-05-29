import { describe, expect, it } from "vitest";

import { createBiometricSetupViewModel } from "./biometric-setup-view-model";

describe("createBiometricSetupViewModel", () => {
  it("returns biometric setup placeholder copy", () => {
    const viewModel = createBiometricSetupViewModel();

    expect(viewModel.title).toBe("Quick unlock");
    expect(viewModel.primaryActionLabel).toBe("Enable biometric unlock");
    expect(viewModel.skipActionLabel).toBe("Skip for now");
  });
});
