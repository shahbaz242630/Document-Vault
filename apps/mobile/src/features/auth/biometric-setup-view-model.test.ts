import { describe, expect, it } from "vitest";

import { createBiometricSetupViewModel } from "./biometric-setup-view-model";

describe("createBiometricSetupViewModel", () => {
  it("returns biometric setup placeholder copy", () => {
    const viewModel = createBiometricSetupViewModel();

    expect(viewModel.title).toBe("Unlock with your face or fingerprint");
    expect(viewModel.primaryActionLabel).toBe("Enable biometric unlock");
    expect(viewModel.skipActionLabel).toBe("Not now");
  });
});
